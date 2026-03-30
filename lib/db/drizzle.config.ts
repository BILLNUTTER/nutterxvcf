import { defineConfig } from "drizzle-kit";
import path from "path";

// Prefer SUPABASE_DATABASE_URL so schema pushes target the same Supabase DB
// used in production. Fall back to local DATABASE_URL when Supabase is not set.
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set");
}

const isSupabase = !!process.env.SUPABASE_DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: isSupabase ? "require" : undefined,
  },
});
