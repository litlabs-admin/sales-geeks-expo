import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`drop schema if exists public cascade`;
await sql`create schema public`;
await sql`grant usage on schema public to postgres, anon, authenticated, service_role`;
await sql`grant all on schema public to postgres, service_role`;
await sql`alter default privileges in schema public grant all on tables to postgres, service_role`;
await sql`alter default privileges in schema public grant all on functions to postgres, service_role`;
await sql`alter default privileges in schema public grant all on sequences to postgres, service_role`;

const files = (await readdir("supabase/sql"))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const path = join("supabase/sql", file);
  const migration = await import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"));
  await sql.unsafe(migration);
  console.log(`Applied ${path}`);
}

await sql.end();
