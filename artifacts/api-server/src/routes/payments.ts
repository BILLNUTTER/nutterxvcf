import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paymentConfirmationsTable } from "@workspace/db/schema";
import { eq, like } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-tokens";
import { z } from "zod";

const router: IRouter = Router();

const MPESA_NUMBER = "0758891491";
// Normalised expected recipient name on this M-Pesa account (collapse spaces, uppercase)
const MPESA_RECIPIENT_NAME = "CALVIN OSORO";

// ── M-Pesa message validation ──────────────────────────────────────────────

/** Extract the unique transaction code (first word of the message). */
function extractCode(msg: string): string | null {
  const m = /^([A-Z0-9]{8,12}) /.exec(msg.trim());
  return m ? m[1] : null;
}

interface ValidationResult {
  valid: true;
  code: string;
}
interface ValidationError {
  valid: false;
  error: string;
}

function validateMpesaMessage(raw: string): ValidationResult | ValidationError {
  const msg = raw.trim();

  // 1. Must start with a valid M-Pesa transaction code then " Confirmed."
  if (!/^[A-Z0-9]{8,12} Confirmed\./.test(msg)) {
    return {
      valid: false,
      error:
        "Invalid message: must start with the M-Pesa transaction code followed by 'Confirmed.' (e.g. UCURIAYGQL Confirmed.).",
    };
  }

  // 2. Extract the sent amount and verify it is exactly Ksh 10.00
  const amountMatch = /Ksh(\d[\d,]*(?:\.\d{1,2})?) sent to/i.exec(msg);
  if (!amountMatch) {
    return {
      valid: false,
      error: "Invalid message: could not find a 'Ksh… sent to' amount.",
    };
  }
  const sentAmount = amountMatch[1].replace(/,/g, "");
  if (parseFloat(sentAmount) !== 10.00 || sentAmount !== "10.00") {
    return {
      valid: false,
      error: `Wrong payment amount: message shows Ksh${amountMatch[1]} but exactly Ksh10.00 is required.`,
    };
  }

  // 3. Extract recipient name + phone and validate both exactly
  const recipientMatch = /sent to ([A-Z][A-Z ]+?)\s+(0758891491)/i.exec(msg);
  if (!recipientMatch) {
    return {
      valid: false,
      error: `Invalid recipient: payment must be sent to ${MPESA_NUMBER}.`,
    };
  }
  const extractedName = recipientMatch[1].trim().replace(/\s+/g, " ").toUpperCase();
  if (extractedName !== MPESA_RECIPIENT_NAME) {
    return {
      valid: false,
      error: "Recipient name does not match the registered account for this M-Pesa number. Do not edit the message.",
    };
  }

  // 4. Must include M-Pesa balance confirmation
  if (!/New M-PESA balance is Ksh/.test(msg)) {
    return {
      valid: false,
      error:
        "Invalid message: missing 'New M-PESA balance is Ksh…' line.",
    };
  }

  // 5. Must include zero transaction cost line
  if (!/Transaction cost, Ksh0\.00/.test(msg)) {
    return {
      valid: false,
      error:
        "Invalid message: missing 'Transaction cost, Ksh0.00' confirmation.",
    };
  }

  // 6. No unexpected characters — only what appears in a real M-Pesa SMS
  //    Allowed: letters, digits, spaces, . , - / : * # ( ) newlines
  if (/[^\w\s.,\-/:*#()\n\r]/.test(msg)) {
    return {
      valid: false,
      error:
        "Message contains unexpected characters. Please paste the exact M-Pesa SMS without editing it.",
    };
  }

  const code = extractCode(msg)!;
  return { valid: true, code };
}

// ── Routes ─────────────────────────────────────────────────────────────────

const SubmitPaymentBody = z.object({
  name: z.string().min(1).max(200).trim(),
  phone: z.string().min(3).max(30).trim(),
  mpesaMessage: z.string().min(10).max(2000).trim(),
});

router.post("/payment-confirmation", async (req, res) => {
  const parsed = SubmitPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { name, phone, mpesaMessage } = parsed.data;

  // ── Validate message format ──
  const validation = validateMpesaMessage(mpesaMessage);
  if (!validation.valid) {
    res.status(400).json({ error: "invalid_mpesa_message", message: validation.error });
    return;
  }

  // ── Check one-time use (code uniqueness) ──
  try {
    const existing = await db
      .select({ id: paymentConfirmationsTable.id })
      .from(paymentConfirmationsTable)
      .where(like(paymentConfirmationsTable.mpesaMessage, `${validation.code} %`))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: "mpesa_code_already_used",
        message:
          `M-Pesa message already used to verify a different number. Send Ksh 10 to ${MPESA_NUMBER} and use the new confirmation message.`,
      });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Failed to check mpesa code uniqueness");
    res.status(500).json({ error: "server_error", message: "Failed to validate payment" });
    return;
  }

  // ── Save ──
  try {
    const [record] = await db
      .insert(paymentConfirmationsTable)
      .values({ name, phone, mpesaMessage })
      .returning();

    res.status(201).json({ success: true, id: record.id });
  } catch (err) {
    req.log.error({ err }, "Failed to save payment confirmation");
    res.status(500).json({ error: "server_error", message: "Failed to save payment confirmation" });
  }
});

router.get("/admin/payment-confirmations", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(paymentConfirmationsTable)
      .orderBy(paymentConfirmationsTable.createdAt);
    res.json({ confirmations: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch payment confirmations");
    res.status(500).json({ error: "server_error", message: "Failed to fetch payment confirmations" });
  }
});

const UpdatePaymentStatusBody = z.object({
  status: z.enum(["pending", "reviewed", "actioned"]),
});

router.patch("/admin/payment-confirmations/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid id" });
    return;
  }
  const parsed = UpdatePaymentStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [updated] = await db
      .update(paymentConfirmationsTable)
      .set({ status: parsed.data.status })
      .where(eq(paymentConfirmationsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Record not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update payment confirmation status");
    res.status(500).json({ error: "server_error", message: "Failed to update status" });
  }
});

router.delete("/admin/payment-confirmations/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(paymentConfirmationsTable)
      .where(eq(paymentConfirmationsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Record not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete payment confirmation");
    res.status(500).json({ error: "server_error", message: "Failed to delete" });
  }
});

export default router;
