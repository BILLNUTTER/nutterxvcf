import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { registrationsTable } from "@workspace/db/schema";
import {
  AdminLoginBody,
  AdminLoginResponse,
  GetAdminRegistrationsResponse,
  UpdateRegistrationStatusBody,
  UpdateRegistrationStatusParams,
} from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ?? crypto.randomBytes(32).toString("hex");

const validTokens = new Set<string>();

function generateToken(username: string): string {
  const token = crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
    .update(`${username}-${Date.now()}`)
    .digest("hex");
  validTokens.add(token);
  return token;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"];
  if (!token || !validTokens.has(token as string)) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or missing admin token" });
    return;
  }
  next();
}

router.post("/admin/login", (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    res.status(500).json({ error: "server_error", message: "Admin credentials not configured" });
    return;
  }

  if (username !== adminUsername || password !== adminPassword) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password" });
    return;
  }

  const token = generateToken(username);
  const response = AdminLoginResponse.parse({ success: true, token });
  res.json(response);
});

router.get("/admin/registrations", requireAdmin, async (req, res) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };

    const conditions: ReturnType<typeof eq>[] = [];
    if (type === "standard" || type === "bot") {
      conditions.push(eq(registrationsTable.registrationType, type));
    }
    if (status === "pending" || status === "approved" || status === "rejected") {
      conditions.push(eq(registrationsTable.status, status));
    }

    const registrations =
      conditions.length > 0
        ? await db
            .select()
            .from(registrationsTable)
            .where(and(...conditions))
            .orderBy(registrationsTable.createdAt)
        : await db
            .select()
            .from(registrationsTable)
            .orderBy(registrationsTable.createdAt);

    const response = GetAdminRegistrationsResponse.parse({
      registrations,
      total: registrations.length,
    });
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch registrations");
    res.status(500).json({ error: "server_error", message: "Failed to fetch registrations" });
  }
});

router.patch("/admin/registrations/:id", requireAdmin, async (req, res) => {
  const paramsParsed = UpdateRegistrationStatusParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateRegistrationStatusBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "validation_error", message: bodyParsed.error.message });
    return;
  }

  const { id } = paramsParsed.data;
  const { status } = bodyParsed.data;

  try {
    const [updated] = await db
      .update(registrationsTable)
      .set({ status })
      .where(eq(registrationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Registration not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update registration");
    res.status(500).json({ error: "server_error", message: "Failed to update registration" });
  }
});

export default router;
