import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
const webUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const brandPrimary = "34 139 86";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, { max: 1 });

await sql`
  update public.events
  set brand_tokens = jsonb_set(brand_tokens, '{primary}', to_jsonb(${brandPrimary}::text))
  where slug = 'sge-2026'
`;

const response = await fetch(`${webUrl}/sge-2026`);
const html = await response.text();

if (!response.ok) {
  throw new Error(`Expected branded event page to return 200, saw ${response.status}`);
}

if (!html.includes(`--brand-primary: ${brandPrimary}`)) {
  throw new Error("Rendered event page did not include updated brand primary CSS variable");
}

await sql.end();
console.log("Branding checks passed.");
