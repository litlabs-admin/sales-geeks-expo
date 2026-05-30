/**
 * Read-only export: dump the full list of records that
 * scripts/cleanup-test-data.ts would delete, for human review before
 * committing to the destructive run.
 *
 * Output: scripts/output/cleanup-preview.txt
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { closeSql, getEventId, sql } from "./lib/phase2";

const EVENT_SLUG = "sge-2026";

// Canonical sponsor names — kept identical to cleanup-test-data.ts.
const SPONSORS = new Set([
  "Alchemy", "Barclays", "Barclays Hampden", "Blueprint Media", "Bridges Finance",
  "Business Gateway Glasgow", "Contact Online", "crea-8-tive",
  "Department of Young Workforce", "Events Hub", "FSB",
  "Glasgow Chamber of Commerce", "Grow Green Now", "IG Photography", "IoD",
  "Kingsmith CASA Property", "Launchit", "Renfrewshire Chamber",
  "Sales Geek Scotland", "Scottish Business Network", "SWIB", "TACT Care",
  "The Independent Buying Group", "Evolution Partnering", "Buttered Host",
  "Heart Lung and Chest", "Acquity Associates", "Digital Landscope", "Roswell",
  "Target Communications", "Vereus", "Openbook Analytics", "Randex", "WBG",
  "Curio Virtual", "Dog Tok AI", "Fazenda", "Get Fully Furnished",
  "HR Services Scotland", "HSBC", "Jolly Media", "Market Locations", "RBS",
  "Cign Post", "BCT", "Fabric Business", "Alleyoop", "Auction House Scotland",
  "Cash For Kids", "different light", "Dunbartonshire Chamber of Commerce",
  "Entrepreneurial Scotland", "ISP", "Kronos", "Data Spike", "Loghouse",
  "Ninety Twenty", "Peek", "Principle Finance Services",
  "Progressive Business Network", "Pufferfish", "Quasi Drinks", "Quensh",
  "Scottish Marketing", "SMART", "STV", "Techtonic Growth Summit", "The Business",
]);

const eventId = await getEventId(EVENT_SLUG);

type AttendeeRow = {
  id: string;
  email: string | null;
  alias: string;
  real_name: string | null;
  business_name: string | null;
  competition_score: number;
  created_at: Date;
  source: string | null;
};

const attendees = await sql<AttendeeRow[]>`
  select a.id, a.email, a.alias, a.real_name, a.business_name,
         a.competition_score, a.created_at,
         (u.raw_user_meta_data->>'source') as source
  from public.attendees a
  left join auth.users u on u.id = a.auth_user_id
  where a.event_id = ${eventId}
    and (u.raw_user_meta_data->>'source') is distinct from 'csv_import_sge2026'
  order by a.created_at asc
`;

type BusinessRow = {
  id: string;
  name: string;
  contact_email: string | null;
  created_at: Date;
};

const businesses = await sql<BusinessRow[]>`
  select id, name, contact_email, created_at
  from public.businesses
  where event_id = ${eventId}
  order by created_at asc
`;

const toDelete = businesses.filter((b) => !SPONSORS.has(b.name));

const lines: string[] = [];
lines.push(`Cleanup preview for sge-2026 (event_id ${eventId})`);
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Re-run scripts/cleanup-test-data.ts --apply to actually delete.\n`);

lines.push("═".repeat(110));
lines.push(`ATTENDEES TO DELETE: ${attendees.length} (out of all attendees whose auth source ≠ csv_import_sge2026)`);
lines.push("═".repeat(110));
lines.push(`  ${"CREATED".padEnd(20)}  ${"EMAIL".padEnd(45)}  ${"ALIAS".padEnd(28)}  ${"NAME".padEnd(22)}  SCORE`);
lines.push("  " + "-".repeat(108));
for (const a of attendees) {
  const ts = a.created_at.toISOString().slice(0, 19).replace("T", " ");
  const email = a.email ?? "—";
  const name = a.real_name ?? "—";
  lines.push(
    `  ${ts.padEnd(20)}  ${email.padEnd(45)}  ${a.alias.padEnd(28)}  ${name.padEnd(22).slice(0, 22)}  ${a.competition_score}`
  );
}

lines.push("");
lines.push("═".repeat(110));
lines.push(`BUSINESSES TO DELETE: ${toDelete.length} (not in the canonical 68-sponsor list)`);
lines.push("═".repeat(110));
lines.push(`  ${"CREATED".padEnd(20)}  ${"NAME".padEnd(45)}  CONTACT EMAIL`);
lines.push("  " + "-".repeat(108));
for (const b of toDelete) {
  const ts = b.created_at.toISOString().slice(0, 19).replace("T", " ");
  lines.push(
    `  ${ts.padEnd(20)}  ${b.name.padEnd(45)}  ${b.contact_email ?? "—"}`
  );
}

const outDir = resolve("scripts/output");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "cleanup-preview.txt");
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

await closeSql();

console.log(`Wrote ${attendees.length} attendees + ${toDelete.length} businesses to:`);
console.log(`  ${outPath}`);
console.log(`\nOpen it (Notepad / VS Code) to review every row before running:`);
console.log(`  pnpm tsx scripts/cleanup-test-data.ts --apply`);
