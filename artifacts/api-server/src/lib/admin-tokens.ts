import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ?? crypto.randomBytes(32).toString("hex");

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const validTokens = new Map<string, number>();

function pruneExpiredTokens(): void {
  const now = Date.now();
  for (const [token, expiresAt] of validTokens) {
    if (now >= expiresAt) {
      validTokens.delete(token);
    }
  }
}

export function generateToken(username: string): string {
  pruneExpiredTokens();
  const token = crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
    .update(`${username}-${Date.now()}`)
    .digest("hex");
  validTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"] as string | undefined;
  const expiresAt = token ? validTokens.get(token) : undefined;
  if (!expiresAt || Date.now() >= expiresAt) {
    if (token && expiresAt) validTokens.delete(token);
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired admin token" });
    return;
  }
  next();
}
