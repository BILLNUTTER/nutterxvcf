import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable, paylorTransactionsTable, registrationsTable } from "@workspace/db/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
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
        callback_url: callbackUrl,  // Paylor expects snake_case
        description: `VCF Registration - ${name}`,
      }),
    });

    const paylorText = await paylorRes.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(paylorText) as Record<string, unknown>; } catch { /* non-JSON */ }

    if (!paylorRes.ok) {
      req.log.error({ data }, "Paylor STK push rejected");
      const msg = (data.message ?? (data.error as Record<string, unknown>)?.message ?? "Payment gateway returned an error. Please try again.") as string;
      res.status(502).json({ error: "paylor_error", message: msg });
      return;
    }

    // Paylor wraps the ID inside a nested "data" object in some versions
    const inner = (data.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>;
    paylorTransactionId = (inner.paymentId ?? inner.payment_id ?? inner.transactionId ?? inner.transaction_id ?? inner.id ?? inner.reference ?? null) as string | undefined;
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

  const PAID_STATUSES = new Set(["success", "completed", "paid", "approved", "successful", "complete"]);
  const FAILED_STATUSES = new Set(["failed", "cancelled", "expired", "reversed"]);

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 25_000);
  try {
    // Correct Paylor endpoint: GET /merchants/payments/transactions/{transactionId}
    const url = `${PAYLOR_BASE}/merchants/payments/transactions/${encodeURIComponent(tx.paylorTransactionId)}`;
    const paylorRes = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    const text = await paylorRes.text();
    req.log.info({ url, httpStatus: paylorRes.status, body: text.slice(0, 500) }, "Paylor status check");

    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(text) as Record<string, unknown>; } catch { /* non-JSON */ }

    // Paylor may wrap the transaction inside a "data" key
    const txData = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
    const flat = { ...raw, ...txData } as Record<string, unknown>;

    liveStatus = (flat.status ?? flat.payment_status ?? flat.transaction_status ?? flat.state ?? "") as string;
    liveStatus = liveStatus.toLowerCase();

    const receiptObj = (flat.metadata && typeof flat.metadata === "object" ? flat.metadata : flat) as Record<string, unknown>;
    mpesaReceipt = (receiptObj.mpesaReceipt ?? receiptObj.mpesa_receipt ?? receiptObj.providerRef ?? null) as string | undefined;
  } catch (err) {
    clearTimeout(timeout);
    req.log.error({ err }, "Paylor live status check failed");
  }

  const isConfirmed = PAID_STATUSES.has(liveStatus ?? "");
  const isFailed = FAILED_STATUSES.has(liveStatus ?? "");

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

// ── GET /api/admin/paylor-transactions ───────────────────────────────────────
router.get("/admin/paylor-transactions", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: paylorTransactionsTable.id,
        reference: paylorTransactionsTable.reference,
        paylorTransactionId: paylorTransactionsTable.paylorTransactionId,
        registrationId: paylorTransactionsTable.registrationId,
        payPhone: paylorTransactionsTable.phone,
        amount: paylorTransactionsTable.amount,
        status: paylorTransactionsTable.status,
        mpesaReceipt: paylorTransactionsTable.mpesaReceipt,
        failureReason: paylorTransactionsTable.failureReason,
        createdAt: paylorTransactionsTable.createdAt,
        updatedAt: paylorTransactionsTable.updatedAt,
        registrantName: registrationsTable.name,
        registrantPhone: registrationsTable.phone,
      })
      .from(paylorTransactionsTable)
      .leftJoin(registrationsTable, eq(paylorTransactionsTable.registrationId, registrationsTable.id))
      .orderBy(desc(paylorTransactionsTable.createdAt));

    const revenueResult = await db
      .select({ total: sql<number>`coalesce(sum(${paylorTransactionsTable.amount}), 0)` })
      .from(paylorTransactionsTable)
      .where(eq(paylorTransactionsTable.status, "completed"));

    const totalRevenue = Number(revenueResult[0]?.total ?? 0);
    const completedCount = rows.filter(r => r.status === "completed").length;

    res.json({ transactions: rows, totalRevenue, completedCount, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch paylor transactions");
    res.status(500).json({ error: "server_error", message: "Failed to fetch transactions" });
  }
});

// ── DELETE /api/admin/paylor-transactions/:id ─────────────────────────────────
router.delete("/admin/paylor-transactions/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid id" });
    return;
  }
  try {
    await db.delete(paylorTransactionsTable).where(eq(paylorTransactionsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete paylor transaction");
    res.status(500).json({ error: "server_error", message: "Failed to delete transaction" });
  }
});

// ── POST /api/paylor/callback ─────────────────────────────────────────────────
router.post("/paylor/callback", async (req, res) => {
  // Paylor sends the signature in different headers depending on version
  const signature = (
    req.headers["x-payment-signature"] ??
    req.headers["x-paylor-signature"] ??
    req.headers["x-webhook-signature"] ??
    req.headers["x-signature"] ??
    ""
  ) as string;

  let webhookSecret = "";
  try {
    const cfg = await getPaylorConfig();
    webhookSecret = cfg.webhookSecret;
  } catch {
    // proceed without verification
  }

  if (webhookSecret && signature) {
    const payload = JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
    // Paylor may prefix with "sha256="
    const receivedHex = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    try {
      const match = crypto.timingSafeEqual(Buffer.from(receivedHex, "hex"), Buffer.from(expected, "hex"));
      if (!match) {
        req.log.warn("Paylor webhook: invalid signature");
        res.status(401).json({ error: "invalid_signature" });
        return;
      }
    } catch {
      req.log.warn("Paylor webhook: signature comparison failed");
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  const body = req.body as Record<string, unknown>;
  // Unwrap nested containers Paylor uses in different versions
  const txNested = (body.transaction && typeof body.transaction === "object" ? body.transaction : {}) as Record<string, unknown>;
  const dataNested = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
  const flat = { ...body, ...dataNested, ...txNested } as Record<string, unknown>;

  const event = (body.event ?? "") as string;
  const internalRef = (flat.reference ?? flat.payment_reference ?? flat.merchantReference ?? "") as string;
  const flatStatus = ((flat.status ?? flat.payment_status ?? flat.transaction_status ?? "") as string).toLowerCase();

  req.log.info({ event, internalRef, flatStatus }, "Paylor webhook received");

  const PAID_STATUSES = new Set(["success", "completed", "paid", "approved", "successful", "complete"]);
  const isSuccess = PAID_STATUSES.has(flatStatus) || event === "payment.success";
  const isFailed = event === "payment.failed" || event === "payment.cancelled" ||
    flatStatus === "failed" || flatStatus === "cancelled";

  if (internalRef) {
    try {
      if (isSuccess) {
        const receiptObj = (flat.metadata && typeof flat.metadata === "object" ? flat.metadata : flat) as Record<string, unknown>;
        const receipt = (receiptObj.mpesaReceipt ?? receiptObj.mpesa_receipt ?? receiptObj.providerRef ?? null) as string | null;

        await db
          .update(paylorTransactionsTable)
          .set({ status: "completed", mpesaReceipt: receipt, updatedAt: new Date() })
          .where(eq(paylorTransactionsTable.reference, internalRef));

        // Auto-approve the registration — no admin action required
        const [localTx] = await db
          .select({ registrationId: paylorTransactionsTable.registrationId })
          .from(paylorTransactionsTable)
          .where(eq(paylorTransactionsTable.reference, internalRef))
          .limit(1);
        if (localTx) {
          await autoApproveRegistration(localTx.registrationId);
          req.log.info({ registrationId: localTx.registrationId }, "Auto-approved registration after payment webhook");
        }
      } else if (isFailed) {
        await db
          .update(paylorTransactionsTable)
          .set({ status: "failed", failureReason: "Payment not completed", updatedAt: new Date() })
          .where(eq(paylorTransactionsTable.reference, internalRef));
      }
    } catch (err) {
      req.log.error({ err }, "Failed to update Paylor tx from webhook");
    }
  }

  res.json({ received: true });
});

export default router;
