import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botVerifiedPhonesTable, registrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-tokens";
import { z } from "zod";
import crypto from "crypto";

const router: IRouter = Router();

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normalise any Kenyan phone input to E.164.
 * Accepted formats (all map to +254XXXXXXXXX):
 *   0712345678      – local 10-digit with leading 0
 *   712345678       – 9-digit without leading 0
 *   254712345678    – country code without +
 *   +254712345678   – already E.164
 * Also accepts any other valid E.164 number unchanged.
 */
function normalisePhone(raw: string): string {
  const trimmed = raw.replace(/\s+/g, "").trim();
  if (E164_REGEX.test(trimmed)) return trimmed;           // already E.164
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10)     // 0712345678
    return `+254${digits.slice(1)}`;
  if (digits.startsWith("254") && digits.length === 12)   // 254712345678
    return `+${digits}`;
  if (digits.length === 9)                                 // 712345678 (no leading 0)
    return `+254${digits}`;
  return trimmed; // return as-is; will fail E164 check and produce a clear error
}

router.post("/admin/bot-verify", requireAdmin, async (req, res) => {
  const parsed = z.object({ phone: z.string().min(7).max(20) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid phone number" });
    return;
  }
  const phone = normalisePhone(parsed.data.phone);
  if (!E164_REGEX.test(phone)) {
    res.status(400).json({ error: "validation_error", message: "Invalid phone number. Enter it as 0712345678 or 712345678 — no need for country code." });
    return;
  }
  try {
    await db
      .insert(botVerifiedPhonesTable)
      .values({ phone })
      .onConflictDoNothing();
    res.json({ success: true, phone });
  } catch (err) {
    req.log.error({ err }, "Failed to add bot-verified phone");
    res.status(500).json({ error: "server_error", message: "Failed to save" });
  }
});

router.delete("/admin/bot-verify/:phone", requireAdmin, async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  try {
    await db.delete(botVerifiedPhonesTable).where(eq(botVerifiedPhonesTable.phone, phone));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove bot-verified phone");
    res.status(500).json({ error: "server_error", message: "Failed to delete" });
  }
});

router.get("/admin/bot-verified", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(botVerifiedPhonesTable).orderBy(botVerifiedPhonesTable.verifiedAt);
    res.json({ entries: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list bot-verified phones");
    res.status(500).json({ error: "server_error", message: "Failed to fetch" });
  }
});

router.get("/bot-check", async (req, res) => {
  const raw = (req.query.phone as string) || "";
  if (!raw) {
    res.status(400).json({ error: "validation_error", message: "phone query param required" });
    return;
  }
  const phone = normalisePhone(raw);
  try {
    const [row] = await db
      .select()
      .from(botVerifiedPhonesTable)
      .where(eq(botVerifiedPhonesTable.phone, phone))
      .limit(1);

    if (!row) {
      res.json({ status: "not_verified" });
      return;
    }
    if (row.registrationId) {
      res.json({ status: "registered" });
      return;
    }
    res.json({ status: "verified" });
  } catch (err) {
    req.log.error({ err }, "bot-check error");
    res.status(500).json({ error: "server_error", message: "Failed to check" });
  }
});

router.post("/bot-complete", async (req, res) => {
  const parsed = z.object({
    phone: z.string().min(7).max(20),
    name: z.string().min(2).max(200).trim(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const phone = normalisePhone(parsed.data.phone);
  const { name } = parsed.data;

  if (!E164_REGEX.test(phone)) {
    res.status(400).json({ error: "validation_error", message: "Invalid phone format" });
    return;
  }

  try {
    const [botRow] = await db
      .select()
      .from(botVerifiedPhonesTable)
      .where(eq(botVerifiedPhonesTable.phone, phone))
      .limit(1);

    if (!botRow) {
      res.status(403).json({ error: "not_verified", message: "Phone number has not been bot-verified by admin." });
      return;
    }
    if (botRow.registrationId) {
      res.status(409).json({ error: "already_registered", message: "This phone number has already completed bot registration." });
      return;
    }

    const countryCode = phone.replace(/\d+$/, "").replace(/\d{0,9}$/, "") || `+${phone.replace(/^\+/, "").slice(0, 3)}`;
    const cc = `+${phone.slice(1, phone.length - 9)}` || "+254";

    const [reg] = await db
      .insert(registrationsTable)
      .values({
        name,
        phone,
        countryCode: cc.startsWith("+") && cc.length <= 5 ? cc : "+254",
        registrationType: "bot",
        status: "approved",
        claimToken: crypto.randomBytes(32).toString("hex"),
      })
      .returning();

    await db
      .update(botVerifiedPhonesTable)
      .set({ registrationId: reg.id })
      .where(eq(botVerifiedPhonesTable.phone, phone));

    res.status(201).json({ success: true, name: reg.name });
  } catch (err) {
    req.log.error({ err }, "bot-complete error");
    res.status(500).json({ error: "server_error", message: "Failed to complete registration" });
  }
});

export default router;
