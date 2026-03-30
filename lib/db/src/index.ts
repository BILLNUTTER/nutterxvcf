import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Prefer local DATABASE_URL (dev/Replit) so the dev server does not
// compete with Vercel serverless functions for Supabase connections.
// On Vercel only SUPABASE_DATABASE_URL is set, so it is used there.
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const isSupabase = !process.env.DATABASE_URL && !!process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  console.warn(
    "[db] WARNING: DATABASE_URL or SUPABASE_DATABASE_URL is not set. " +
    "Database operations will fail. Set the variable and restart.",
  );
}

export const pool = new Pool({
  connectionString: connectionString ?? "postgresql://localhost:5432/notconfigured",
  ssl: isSupabase ? { rejectUnauthorized: false } : false,

  // Small pool for Supabase (transaction pooler); generous for local Postgres.
  max: isSupabase ? 3 : 10,
  idleTimeoutMillis: isSupabase ? 10_000 : 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
