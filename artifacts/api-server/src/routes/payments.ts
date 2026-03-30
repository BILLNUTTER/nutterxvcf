import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paymentConfirmationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-tokens";
import { z } from "zod";

const router: IRouter = Router();

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

  try {
    const [record] = await db
      .insert(paymentConfirmationsTable)
      .values({
        name: parsed.data.name,
        phone: parsed.data.phone,
        mpesaMessage: parsed.data.mpesaMessage,
      })
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
