import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (supabaseUrl.includes("prd") || supabaseUrl.includes("prod")) {
  throw new Error("Refusing to truncate a production-looking Supabase project");
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`
  truncate table
    public.audit_logs,
    public.events
  restart identity cascade
`;

await sql.end();
console.log("Truncated Phase 0 app tables.");
