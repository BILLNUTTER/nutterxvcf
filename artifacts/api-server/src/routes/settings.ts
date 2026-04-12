import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { registrationsTable, settingsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/admin-tokens";
import { z } from "zod";

const router: IRouter = Router();

const DEFAULT_TARGETS: Record<string, number> = {
  standard_target: 500,
  bot_target: 200,
};

const DEFAULT_FEE = 10;

async function getTarget(key: string): Promise<number> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  if (!row) return DEFAULT_TARGETS[key] ?? 100;
  const parsed = parseInt(row.value, 10);
  return isNaN(parsed) ? (DEFAULT_TARGETS[key] ?? 100) : parsed;
}

export async function getRegistrationFee(): Promise<number> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "registration_fee"))
    .limit(1);
  if (!row) return DEFAULT_FEE;
  const parsed = parseFloat(row.value);
  return isNaN(parsed) || parsed <= 0 ? DEFAULT_FEE : parsed;
}

async function getApprovedCount(type: "standard" | "bot"): Promise<number> {
  const rows = await db
    .select({ id: registrationsTable.id })
    .from(registrationsTable)
    .where(
      and(
        eq(registrationsTable.registrationType, type),
        eq(registrationsTable.status, "approved"),
      ),
    );
  return rows.length;
}

router.get("/settings", async (req, res) => {
  try {
    const [standardTarget, botTarget, standardApproved, botApproved, registrationFee] = await Promise.all([
      getTarget("standard_target"),
      getTarget("bot_target"),
      getApprovedCount("standard"),
      getApprovedCount("bot"),
      getRegistrationFee(),
    ]);

    res.json({ standardTarget, botTarget, standardApproved, botApproved, registrationFee });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch settings");
    res.status(500).json({ error: "server_error", message: "Failed to fetch settings" });
  }
});

const UpdateSettingBody = z.object({
  type: z.enum(["standard", "bot"]).optional(),
  target: z.number().int().min(1).max(100000).optional(),
  registrationFee: z.number().positive().max(1000000).optional(),
});

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

router.patch("/admin/settings", requireAdmin, async (req, res) => {
  const parsed = UpdateSettingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { type, target, registrationFee } = parsed.data;

  try {
    const ops: Promise<void>[] = [];

    if (type && target !== undefined) {
      const key = type === "standard" ? "standard_target" : "bot_target";
      ops.push(upsertSetting(key, String(target)));
    }

    if (registrationFee !== undefined) {
      ops.push(upsertSetting("registration_fee", String(registrationFee)));
    }

    if (ops.length === 0) {
      res.status(400).json({ error: "bad_request", message: "Nothing to update." });
      return;
    }

    await Promise.all(ops);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update setting");
    res.status(500).json({ error: "server_error", message: "Failed to update setting" });
  }
});

// ── Maintenance mode ─────────────────────────────────────────────────────────

const MAINTENANCE_KEYS = [
  "maintenance_enabled",
  "maintenance_title",
  "maintenance_reasons",
  "maintenance_eta",
] as const;

export async function getMaintenanceStatus() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...MAINTENANCE_KEYS]));
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;

  let reasons: string[] = [];
  try {
    if (cfg.maintenance_reasons) reasons = JSON.parse(cfg.maintenance_reasons) as string[];
  } catch { /* ignore */ }

  return {
    enabled: cfg.maintenance_enabled === "true",
    title: cfg.maintenance_title || "Service Under Maintenance",
    reasons,
    eta: cfg.maintenance_eta || "",
  };
}

router.get("/maintenance", async (_req, res) => {
  try {
    const status = await getMaintenanceStatus();
    res.json(status);
  } catch {
    res.json({ enabled: false, title: "Service Under Maintenance", reasons: [], eta: "" });
  }
});

const MaintenanceBody = z.object({
  enabled: z.boolean().optional(),
  title: z.string().max(200).optional(),
  reasons: z.array(z.string().max(300)).max(20).optional(),
  eta: z.string().max(200).optional(),
});

router.patch("/admin/maintenance", requireAdmin, async (req, res) => {
  const parsed = MaintenanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { enabled, title, reasons, eta } = parsed.data;
  try {
    const ops: Promise<void>[] = [];
    if (enabled !== undefined) ops.push(upsertSetting("maintenance_enabled", String(enabled)));
    if (title !== undefined) ops.push(upsertSetting("maintenance_title", title));
    if (reasons !== undefined) ops.push(upsertSetting("maintenance_reasons", JSON.stringify(reasons)));
    if (eta !== undefined) ops.push(upsertSetting("maintenance_eta", eta));

    if (ops.length === 0) {
      res.status(400).json({ error: "bad_request", message: "Nothing to update." });
      return;
    }

    await Promise.all(ops);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update maintenance settings");
    res.status(500).json({ error: "server_error", message: "Failed to update maintenance settings" });
  }
});

export { getTarget, getApprovedCount };
export default router;
