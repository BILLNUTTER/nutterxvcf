import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  // Warn instead of crashing — some routes (e.g. admin login) don't need the DB.
  // Actual DB queries will fail with a connection error at runtime.
  console.warn(
    "[db] WARNING: SUPABASE_DATABASE_URL or DATABASE_URL is not set. " +
    "Database operations will fail. Set the variable and restart.",
  );
}

export const pool = new Pool({
  // Fall back to an invalid string so Pool construction doesn't throw.
  // Any actual query will surface a clear connection error.
  connectionString: connectionString ?? "postgresql://localhost:5432/notconfigured",
  ssl: process.env.SUPABASE_DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
