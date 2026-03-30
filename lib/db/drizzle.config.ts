import { defineConfig } from "drizzle-kit";
import path from "path";

// Prefer local DATABASE_URL (dev/Replit) so migrations don't run against
// the production Supabase DB. On Vercel only SUPABASE_DATABASE_URL is set.
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or SUPABASE_DATABASE_URL must be set");
}

const isSupabase = !process.env.DATABASE_URL && !!process.env.SUPABASE_DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: isSupabase ? "require" : undefined,
  },
});
