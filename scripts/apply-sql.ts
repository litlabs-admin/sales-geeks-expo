import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
const file = process.argv[2];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (!file) {
  throw new Error("Usage: tsx scripts/apply-sql.ts <sql-file>");
}

const sql = postgres(databaseUrl, { max: 1 });
const migration = await readFile(file, "utf8");

await sql.unsafe(migration);
await sql.end();

console.log(`Applied ${file}`);
