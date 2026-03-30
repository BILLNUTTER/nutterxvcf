import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";

// Use a stable secret from env so all Vercel instances share the same key.
// If not set, fall back to a random value (dev only — tokens won't survive restarts).
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ?? crypto.randomBytes(32).toString("hex");

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ─── Stateless HMAC token ────────────────────────────────────────────────────
// Format: "<expiresAt>.<signature>"
// expiresAt  = Unix ms timestamp (decimal string)
// signature  = HMAC-SHA256 of "<username>:<expiresAt>" keyed with the secret
//
// Any server instance that knows the secret can verify the token without shared
// in-memory state — essential for Vercel serverless where each cold-start is
// a fresh process.

function sign(username: string, expiresAt: number): string {
  return crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
    .update(`${username}:${expiresAt}`)
    .digest("hex");
}

export function generateToken(username: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const sig = sign(username, expiresAt);
  // Encode as base64url so it's URL-safe and opaque to the client
  return Buffer.from(`${expiresAt}.${sig}`).toString("base64url");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers["x-admin-token"] as string | undefined;
  if (!raw) {
    res.status(401).json({ error: "unauthorized", message: "Admin token required" });
    return;
  }

  let expiresAt: number;
  let sig: string;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const dotIdx = decoded.indexOf(".");
    if (dotIdx === -1) throw new Error("bad format");
    expiresAt = Number(decoded.slice(0, dotIdx));
    sig = decoded.slice(dotIdx + 1);
    if (!Number.isFinite(expiresAt) || !sig) throw new Error("bad fields");
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Malformed admin token" });
    return;
  }

  if (Date.now() >= expiresAt) {
    res.status(401).json({ error: "unauthorized", message: "Admin token expired — please log in again" });
    return;
  }

  // Verify HMAC against the stored admin username
  const adminUsername = process.env.ADMIN_USERNAME ?? "";
  const expected = sign(adminUsername, expiresAt);
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
    res.status(401).json({ error: "unauthorized", message: "Invalid admin token" });
    return;
  }

  next();
}
