import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Prefer local DATABASE_URL (Replit dev) so the dev server does not compete
// with Vercel serverless functions for Supabase connections.
// On Vercel only SUPABASE_DATABASE_URL is set, so it is used there.
const rawConnectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const isSupabase = !process.env.DATABASE_URL && !!process.env.SUPABASE_DATABASE_URL;

if (!rawConnectionString) {
  console.warn(
    "[db] WARNING: DATABASE_URL or SUPABASE_DATABASE_URL is not set. " +
    "Database operations will fail.",
  );
}

// For serverless (Vercel), auto-upgrade Supabase Session-mode pooler (port 5432)
// to Transaction-mode pooler (port 6543). Transaction mode releases the server
// connection after every query — no "MaxClientsInSessionMode" errors.
function resolveConnectionString(url: string, supabase: boolean): string {
  if (!supabase) return url;
  // Only rewrite Supabase pooler URLs (*.pooler.supabase.com).
  // Direct DB URLs (db.*.supabase.co) are left unchanged.
  return url.replace(
    /(\.pooler\.supabase\.com):5432(\b)/g,
    "$1:6543$2",
  );
}

const connectionString = rawConnectionString
  ? resolveConnectionString(rawConnectionString, isSupabase)
  : "postgresql://localhost:5432/notconfigured";

if (isSupabase && rawConnectionString && connectionString !== rawConnectionString) {
  console.info("[db] Supabase pooler: switched from Session mode (5432) to Transaction mode (6543).");
}

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,

  // Transaction mode: one connection per concurrent query is sufficient.
  // Keep the pool tiny to stay well within Supabase's connection limits.
  max: isSupabase ? 2 : 10,
  idleTimeoutMillis: isSupabase ? 10_000 : 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
