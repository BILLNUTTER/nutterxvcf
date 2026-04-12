import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable, paylorTransactionsTable, registrationsTable } from "@workspace/db/schema";
import { eq, inArray, desc, sql, and } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-tokens";
import { z } from "zod";
import crypto from "crypto";
import { getRegistrationFee } from "./settings";
import type { PaylorTransaction } from "@workspace/db/schema";

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

function generateClaimToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Auto-create (if needed) and approve the registration linked to a Paylor
 * transaction.  This is the ONLY place a Standard registration is created —
 * ensuring no phone ever enters the system before payment is confirmed.
 *
 * - If the transaction already has a registrationId, just mark it approved.
 * - If not, create a new registration with status "approved" immediately,
 *   then store the id back on the transaction row.
 */
async function autoCreateAndApproveRegistration(tx: PaylorTransaction) {
  // ── Legacy path: registration was pre-created (old transactions) ──────────
  if (tx.registrationId !== null && tx.registrationId !== undefined) {
    await db
      .update(registrationsTable)
      .set({ status: "approved" })
      .where(eq(registrationsTable.id, tx.registrationId));
    return;
  }

  // ── New path: create registration on first payment confirmation ───────────
  const rName = tx.registrantName;
  const rPhone = tx.registrantPhone;
  const rCC = tx.registrantCountryCode;

  if (!rName || !rPhone || !rCC) {
    // Cannot create — missing data (very old row, skip)
    return;
  }

  // Check if registration already exists for this phone (idempotency)
  const [existing] = await db
    .select({ id: registrationsTable.id })
    .from(registrationsTable)
    .where(
      and(
        eq(registrationsTable.phone, rPhone),
        eq(registrationsTable.registrationType, "standard"),
      ),
    )
    .limit(1);

  let regId: number;

  if (existing) {
    // Approve the existing record and link it
    regId = existing.id;
    await db
      .update(registrationsTable)
      .set({ status: "approved" })
      .where(eq(registrationsTable.id, regId));
  } else {
    // Create brand-new registration, already approved
    const [newReg] = await db
      .insert(registrationsTable)
      .values({
        name: rName,
        phone: rPhone,
        countryCode: rCC,
        registrationType: "standard",
        status: "approved",
        claimToken: generateClaimToken(),
      })
      .returning({ id: registrationsTable.id });
    regId = newReg.id;
  }

  // Link the transaction to the (new or existing) registration row
  await db
    .update(paylorTransactionsTable)
    .set({ registrationId: regId, updatedAt: new Date() })
    .where(eq(paylorTransactionsTable.id, tx.id));
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
// Accepts registrant details — NO pre-registration. The registration row is
// only created (as "approved") once Paylor confirms payment.
const InitiateBody = z.object({
  name: z.string().min(1).max(200),
  registrantPhone: z.string().min(10).max(20),
  registrantCountryCode: z.string().min(2).max(8),
  payPhone: z.string().min(10).max(20),
});

router.post("/paylor/initiate", async (req, res) => {
  const parsed = InitiateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid payment details." });
    return;
  }
  const { name, registrantPhone, registrantCountryCode, payPhone } = parsed.data;

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

  // Block suspended or already-approved registrations
  const [existingReg] = await db
    .select({ id: registrationsTable.id, status: registrationsTable.status })
    .from(registrationsTable)
    .where(
      and(
        eq(registrationsTable.phone, registrantPhone),
        eq(registrationsTable.registrationType, "standard"),
      ),
    )
    .limit(1);

  if (existingReg) {
    if (existingReg.status === "suspended") {
      res.status(403).json({ error: "suspended", message: "This phone number has been suspended. Contact support on +254758891491." });
      return;
    }
    res.status(409).json({ error: "already_registered", message: "This phone number is already registered for Standard VCF." });
    return;
  }

  // Dedup: if there's a recent pending transaction for this registrant phone, reuse it
  const [existingTx] = await db
    .select()
    .from(paylorTransactionsTable)
    .where(eq(paylorTransactionsTable.registrantPhone, registrantPhone))
    .orderBy(desc(paylorTransactionsTable.createdAt))
    .limit(1);

  if (existingTx) {
    if (existingTx.status === "completed") {
      res.status(409).json({ error: "already_paid", message: "Payment already confirmed for this number." });
      return;
    }
    const ageMs = Date.now() - new Date(existingTx.createdAt).getTime();
    if (existingTx.status === "pending" && ageMs < 90_000) {
      res.json({ success: true, reference: existingTx.reference, message: "STK Push already sent" });
      return;
    }
  }

  const reference = `VCF-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  const callbackUrl =
    config.callbackUrl ||
    `${req.protocol}://${req.get("host")}/api/paylor/callback`;

  const fee = await getRegistrationFee();

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
        phone: payPhone.replace(/^\+/, ""),
        amount: fee,
        channelId: config.channelId,
        reference,
        callback_url: callbackUrl,
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

    const inner = (data.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>;
    paylorTransactionId = (inner.paymentId ?? inner.payment_id ?? inner.transactionId ?? inner.transaction_id ?? inner.id ?? inner.reference ?? null) as string | undefined;
  } catch (err) {
    req.log.error({ err }, "Paylor API unreachable");
    res.status(502).json({ error: "paylor_unreachable", message: "Could not reach the payment gateway. Check your internet and try again." });
    return;
  }

  // Save transaction — NO registrationId yet; registrant data stored for later
  try {
    await db
      .insert(paylorTransactionsTable)
      .values({
        paylorTransactionId: paylorTransactionId ?? null,
        reference,
        registrationId: null,
        phone: payPhone,
        amount: fee,
        status: "pending",
        registrantName: name,
        registrantPhone,
        registrantCountryCode,
      })
      .onConflictDoUpdate({
        target: paylorTransactionsTable.reference,
        set: {
          paylorTransactionId: paylorTransactionId ?? null,
          status: "pending",
          updatedAt: new Date(),
        },
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

    if (tx.status === "completed") {
      try {
        await autoCreateAndApproveRegistration(tx);
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

  const [tx] = await db
    .select()
    .from(paylorTransactionsTable)
    .where(eq(paylorTransactionsTable.reference, reference))
    .limit(1);

  if (!tx) {
    res.status(404).json({ error: "not_found", message: "Payment record not found. Please start over." });
    return;
  }

  if (tx.status === "completed") {
    try {
      await autoCreateAndApproveRegistration(tx);
    } catch { /* non-fatal */ }
    res.json({ status: "completed", message: "Payment already confirmed." });
    return;
  }

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
    await db
      .update(paylorTransactionsTable)
      .set({ status: "completed", mpesaReceipt: mpesaReceipt ?? null, updatedAt: new Date() })
      .where(eq(paylorTransactionsTable.reference, reference));

    // Fetch the refreshed tx row (now has registrant data) for creation
    const [refreshedTx] = await db
      .select()
      .from(paylorTransactionsTable)
      .where(eq(paylorTransactionsTable.reference, reference))
      .limit(1);

    if (refreshedTx) {
      await autoCreateAndApproveRegistration(refreshedTx);
    }

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
        registrantPhone: paylorTransactionsTable.registrantPhone,
        registrantName: paylorTransactionsTable.registrantName,
        amount: paylorTransactionsTable.amount,
        status: paylorTransactionsTable.status,
        mpesaReceipt: paylorTransactionsTable.mpesaReceipt,
        failureReason: paylorTransactionsTable.failureReason,
        createdAt: paylorTransactionsTable.createdAt,
        updatedAt: paylorTransactionsTable.updatedAt,
        registrantPhone2: registrationsTable.phone,
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

        // Fetch the full updated transaction (includes registrant data)
        const [localTx] = await db
          .select()
          .from(paylorTransactionsTable)
          .where(eq(paylorTransactionsTable.reference, internalRef))
          .limit(1);

        if (localTx) {
          await autoCreateAndApproveRegistration(localTx);
          req.log.info(
            { registrantPhone: localTx.registrantPhone, registrationId: localTx.registrationId },
            "Auto-created and approved registration after payment webhook",
          );
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
