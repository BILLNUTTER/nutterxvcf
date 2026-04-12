import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable, paylorTransactionsTable, registrationsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-tokens";
import { z } from "zod";
import crypto from "crypto";

const router: IRouter = Router();

const PAYLOR_BASE = "https://api.paylorke.com/api/v1";

const PAYLOR_KEYS = [
  "paylor_api_key",
  "paylor_channel_id",
  "paylor_webhook_secret",
  "paylor_enabled",
  "paylor_callback_url",
] as const;

async function getPaylorConfig() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...PAYLOR_KEYS]));
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;
  return {
    apiKey: cfg.paylor_api_key ?? "",
    channelId: cfg.paylor_channel_id ?? "",
    webhookSecret: cfg.paylor_webhook_secret ?? "",
    enabled: cfg.paylor_enabled === "true",
    callbackUrl: cfg.paylor_callback_url ?? "",
  };
}

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

/** Auto-approve a registration that has been paid for. */
async function autoApproveRegistration(registrationId: number) {
  await db
    .update(registrationsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(registrationsTable.id, registrationId));
}

// ── Public: check if Paylor is enabled ──────────────────────────────────────
router.get("/paylor/config", async (req, res) => {
  try {
    const cfg = await getPaylorConfig();
    res.json({ enabled: cfg.enabled && !!cfg.apiKey && !!cfg.channelId });
  } catch {
    res.json({ enabled: false });
  }
});

// ── Admin: GET Paylor settings ───────────────────────────────────────────────
router.get("/admin/paylor-settings", requireAdmin, async (req, res) => {
  try {
    const cfg = await getPaylorConfig();
    res.json({
      apiKey: cfg.apiKey ? cfg.apiKey.slice(0, 10) + "••••••••" : "",
      channelId: cfg.channelId,
      webhookSecret: cfg.webhookSecret ? "••••••••" : "",
      enabled: cfg.enabled,
      callbackUrl: cfg.callbackUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Paylor settings");
    res.status(500).json({ error: "server_error", message: "Failed to fetch settings" });
  }
});

// ── Admin: PATCH Paylor settings ─────────────────────────────────────────────
const PaylorSettingsBody = z.object({
  apiKey: z.string().optional(),
  channelId: z.string().optional(),
  webhookSecret: z.string().optional(),
  enabled: z.boolean().optional(),
  callbackUrl: z.string().optional(),
});

router.patch("/admin/paylor-settings", requireAdmin, async (req, res) => {
  const parsed = PaylorSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const { apiKey, channelId, webhookSecret, enabled, callbackUrl } = parsed.data;
    const ops: Promise<void>[] = [];
    if (apiKey !== undefined && !apiKey.includes("••••••••"))
      ops.push(upsertSetting("paylor_api_key", apiKey));
    if (channelId !== undefined)
      ops.push(upsertSetting("paylor_channel_id", channelId));
    if (webhookSecret !== undefined && !webhookSecret.includes("••••••••"))
      ops.push(upsertSetting("paylor_webhook_secret", webhookSecret));
    if (enabled !== undefined)
      ops.push(upsertSetting("paylor_enabled", String(enabled)));
    if (callbackUrl !== undefined)
      ops.push(upsertSetting("paylor_callback_url", callbackUrl));
    await Promise.all(ops);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update Paylor settings");
    res.status(500).json({ error: "server_error", message: "Failed to save settings" });
  }
});

// ── POST /api/paylor/initiate ─────────────────────────────────────────────────
const InitiateBody = z.object({
  registrationId: z.number().int().positive(),
  phone: z.string().min(10).max(20),
  name: z.string().min(1).max(200),
});

router.post("/paylor/initiate", async (req, res) => {
  const parsed = InitiateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid payment details." });
    return;
  }
  const { registrationId, phone, name } = parsed.data;

  const config = await getPaylorConfig().catch(() => null);
  if (!config) {
    res.status(500).json({ error: "server_error", message: "Payment service unavailable. Please try again." });
    return;
  }
  if (!config.enabled) {
    res.status(503).json({ error: "paylor_disabled", message: "Automated payments are not enabled. Contact admin on 0758891491." });
    return;
  }
  if (!config.apiKey || !config.channelId) {
    res.status(503).json({ error: "paylor_unconfigured", message: "Payment gateway not configured. Contact admin on 0758891491." });
    return;
  }

  // Verify registration exists
  const [reg] = await db
    .select({ id: registrationsTable.id })
    .from(registrationsTable)
    .where(eq(registrationsTable.id, registrationId))
    .limit(1);
  if (!reg) {
    res.status(404).json({ error: "not_found", message: "Registration not found. Please restart the process." });
    return;
  }

  // Check for existing transaction
  const [existingTx] = await db
    .select()
    .from(paylorTransactionsTable)
    .where(eq(paylorTransactionsTable.registrationId, registrationId))
    .limit(1);

  if (existingTx) {
    if (existingTx.status === "completed") {
      res.status(409).json({ error: "already_paid", message: "Payment already confirmed for this registration." });
      return;
    }
    const ageMs = Date.now() - new Date(existingTx.createdAt).getTime();
    if (existingTx.status === "pending" && ageMs < 90_000) {
      res.json({ success: true, reference: existingTx.reference, message: "STK Push already sent" });
      return;
    }
  }

  const reference = `VCF-${registrationId}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const callbackUrl =
    config.callbackUrl ||
    `${req.protocol}://${req.get("host")}/api/paylor/callback`;

  // Initiate STK push
  let paylorTransactionId: string | undefined;
  try {
    const paylorRes = await fetch(`${PAYLOR_BASE}/merchants/payments/stk-push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Daraja (M-Pesa) expects the number without the leading '+', e.g. 254XXXXXXXXX
        phone: phone.replace(/^\+/, ""),
        amount: 10,
        channelId: config.channelId,
        reference,
        callbackUrl,
        description: `VCF Registration - ${name}`,
      }),
    });

    const data = (await paylorRes.json()) as { transactionId?: string; message?: string };
    if (!paylorRes.ok) {
      req.log.error({ data }, "Paylor STK push rejected");
      res.status(502).json({ error: "paylor_error", message: data.message ?? "Payment gateway returned an error. Please try again." });
      return;
    }
    paylorTransactionId = data.transactionId;
  } catch (err) {
    req.log.error({ err }, "Paylor API unreachable");
    res.status(502).json({ error: "paylor_unreachable", message: "Could not reach the payment gateway. Check your internet and try again." });
    return;
  }

  // Save transaction
  try {
    await db
      .insert(paylorTransactionsTable)
      .values({
        paylorTransactionId: paylorTransactionId ?? null,
        reference,
        registrationId,
        phone,
        amount: 10,
        status: "pending",
      })
      .onConflictDoUpdate({
        target: paylorTransactionsTable.reference,
        set: { paylorTransactionId: paylorTransactionId ?? null, status: "pending", updatedAt: new Date() },
      });
  } catch (err) {
    req.log.error({ err }, "Failed to save Paylor transaction to DB");
  }

  res.json({ success: true, reference, transactionId: paylorTransactionId, message: "STK Push sent" });
});

// ── GET /api/paylor/status/:reference ────────────────────────────────────────
router.get("/paylor/status/:reference", async (req, res) => {
  const { reference } = req.params;
  try {
    const [tx] = await db
      .select()
      .from(paylorTransactionsTable)
      .where(eq(paylorTransactionsTable.reference, reference))
      .limit(1);
    if (!tx) {
      res.status(404).json({ error: "not_found", message: "Transaction not found" });
      return;
    }

    // If still pending, auto-approve in DB if somehow already completed
    if (tx.status === "completed") {
      try {
        await autoApproveRegistration(tx.registrationId);
      } catch {
        // non-fatal
      }
    }

    res.json({
      status: tx.status,
      reference: tx.reference,
      mpesaReceipt: tx.mpesaReceipt,
      failureReason: tx.failureReason,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Paylor transaction status");
    res.status(500).json({ error: "server_error", message: "Failed to fetch status" });
  }
});

// ── POST /api/paylor/verify ──────────────────────────────────────────────────
// Called by the frontend "Verify Payment" button. Queries Paylor's live API
// (not just local DB) so a failed callback doesn't block the user.
const VerifyBody = z.object({
  reference: z.string().min(1),
});

router.post("/paylor/verify", async (req, res) => {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Reference is required." });
    return;
  }
  const { reference } = parsed.data;

  // Look up local transaction record
  const [tx] = await db
    .select()
    .from(paylorTransactionsTable)
    .where(eq(paylorTransactionsTable.reference, reference))
    .limit(1);

  if (!tx) {
    res.status(404).json({ error: "not_found", message: "Payment record not found. Please start over." });
    return;
  }

  // Already confirmed locally — just auto-approve and return
  if (tx.status === "completed") {
    try {
      await autoApproveRegistration(tx.registrationId);
    } catch {
      // non-fatal
    }
    res.json({ status: "completed", message: "Payment already confirmed." });
    return;
  }

  // Query Paylor's live API using the transaction ID
  const config = await getPaylorConfig().catch(() => null);
  if (!config?.apiKey) {
    res.status(503).json({ error: "paylor_unconfigured", message: "Payment gateway not configured. Contact admin on 0758891491." });
    return;
  }

  if (!tx.paylorTransactionId) {
    res.status(422).json({ error: "no_transaction_id", message: "No payment transaction ID found. Please try paying again." });
    return;
  }

  let liveStatus: string | undefined;
  let mpesaReceipt: string | undefined;

  try {
    const paylorRes = await fetch(
      `${PAYLOR_BASE}/merchants/payments/${encodeURIComponent(tx.paylorTransactionId)}`,
      {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      },
    );

    if (paylorRes.ok) {
      const data = (await paylorRes.json()) as {
        status?: string;
        metadata?: { mpesaReceipt?: string };
        mpesaReceipt?: string;
      };
      liveStatus = data.status?.toLowerCase();
      mpesaReceipt = data.metadata?.mpesaReceipt ?? data.mpesaReceipt;
    } else {
      req.log.warn({ ref: reference }, "Paylor live status check returned non-OK");
    }
  } catch (err) {
    req.log.error({ err }, "Paylor live status check failed");
  }

  // Map Paylor status to our status
  const isConfirmed = liveStatus === "completed" || liveStatus === "success" || liveStatus === "paid";
  const isFailed = liveStatus === "failed" || liveStatus === "cancelled" || liveStatus === "expired";

  if (isConfirmed) {
    // Update local DB
    await db
      .update(paylorTransactionsTable)
      .set({ status: "completed", mpesaReceipt: mpesaReceipt ?? null, updatedAt: new Date() })
      .where(eq(paylorTransactionsTable.reference, reference));

    // Auto-approve registration
    await autoApproveRegistration(tx.registrationId);

    res.json({ status: "completed", message: "Payment verified and registration approved." });
    return;
  }

  if (isFailed) {
    await db
      .update(paylorTransactionsTable)
      .set({ status: "failed", failureReason: "Payment not completed", updatedAt: new Date() })
      .where(eq(paylorTransactionsTable.reference, reference));
    res.json({ status: "failed", message: "Payment was not completed. Please try again." });
    return;
  }

  // Still pending according to Paylor
  res.json({ status: "pending", message: "Payment not confirmed yet. Please enter your M-Pesa PIN if you have not done so." });
});

// ── POST /api/paylor/callback ─────────────────────────────────────────────────
router.post("/paylor/callback", async (req, res) => {
  const signature = req.headers["x-webhook-signature"] as string | undefined;

  let webhookSecret = "";
  try {
    const cfg = await getPaylorConfig();
    webhookSecret = cfg.webhookSecret;
  } catch {
    // proceed without verification
  }

  if (webhookSecret && signature) {
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (signature !== expected) {
      req.log.warn("Paylor webhook: invalid signature");
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  const { event, transaction } = req.body as {
    event?: string;
    transaction?: {
      id?: string;
      reference?: string;
      amount?: number;
      status?: string;
      metadata?: { mpesaReceipt?: string };
    };
  };

  req.log.info({ event, ref: transaction?.reference }, "Paylor webhook");

  if (transaction?.reference) {
    try {
      if (event === "payment.success") {
        // Update transaction to completed
        await db
          .update(paylorTransactionsTable)
          .set({ status: "completed", mpesaReceipt: transaction.metadata?.mpesaReceipt ?? null, updatedAt: new Date() })
          .where(eq(paylorTransactionsTable.reference, transaction.reference));

        // Auto-approve the registration — no admin action required
        const [tx] = await db
          .select({ registrationId: paylorTransactionsTable.registrationId })
          .from(paylorTransactionsTable)
          .where(eq(paylorTransactionsTable.reference, transaction.reference))
          .limit(1);
        if (tx) {
          await autoApproveRegistration(tx.registrationId);
          req.log.info({ registrationId: tx.registrationId }, "Auto-approved registration after payment");
        }
      } else if (event === "payment.failed" || event === "payment.cancelled") {
        await db
          .update(paylorTransactionsTable)
          .set({ status: "failed", failureReason: "Payment not completed", updatedAt: new Date() })
          .where(eq(paylorTransactionsTable.reference, transaction.reference));
      }
    } catch (err) {
      req.log.error({ err }, "Failed to update Paylor tx from webhook");
    }
  }

  res.json({ received: true });
});

export default router;
