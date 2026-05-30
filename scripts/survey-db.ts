/**
 * Read-only survey of the sge-2026 dataset.
 * Helps separate real records (CSV-imported sponsors / attendees) from
 * test fixtures so we can target a safe cleanup.
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId("sge-2026");
console.log(`Event sge-2026 → ${eventId}\n`);

// ── Businesses ────────────────────────────────────────────────────────────
const businesses = await sql<Array<{
  id: string; name: string; contact_email: string | null; created_at: Date;
}>>`
  select id, name, contact_email, created_at
  from public.businesses
  where event_id = ${eventId}
  order by created_at asc
`;

console.log(`Businesses: ${businesses.length}`);
console.log("─".repeat(80));
for (const b of businesses) {
  const ts = b.created_at.toISOString().slice(0, 19).replace("T", " ");
  console.log(`  ${ts}  ${b.name.padEnd(40)}  ${b.contact_email ?? "—"}`);
}

// ── Attendees grouped by source ───────────────────────────────────────────
type AttendeeRow = {
  email: string | null; alias: string; real_name: string | null;
  business_name: string | null; created_at: Date;
  competition_score: number;
  source: string | null;
};

const attendees = await sql<AttendeeRow[]>`
  select
    a.email, a.alias, a.real_name, a.business_name, a.created_at,
    a.competition_score,
    (u.raw_user_meta_data->>'source') as source
  from public.attendees a
  left join auth.users u on u.id = a.auth_user_id
  where a.event_id = ${eventId}
  order by a.created_at asc
`;

console.log(`\nAttendees: ${attendees.length}`);
console.log("─".repeat(80));

const groups = {
  csvImport: [] as AttendeeRow[],
  exampleTest: [] as AttendeeRow[],
  seed: [] as AttendeeRow[],
  other: [] as AttendeeRow[],
};

for (const a of attendees) {
  if (a.source === "csv_import_sge2026") groups.csvImport.push(a);
  else if ((a.email ?? "").endsWith("@example.test")) groups.exampleTest.push(a);
  else if (a.alias.startsWith("Seed-")) groups.seed.push(a);
  else groups.other.push(a);
}

console.log(`\n  ✅ CSV import (real Forumm attendees): ${groups.csvImport.length}`);
console.log(`  ❌ @example.test emails (test fixtures): ${groups.exampleTest.length}`);
console.log(`  ❌ Seed-N aliases (phase 2 fixtures):    ${groups.seed.length}`);
console.log(`  ⚠️  Other / created via app (review):     ${groups.other.length}`);

if (groups.other.length > 0) {
  console.log("\n  --- 'Other' attendees (likely your test accounts; please review): ---");
  for (const a of groups.other) {
    const ts = a.created_at.toISOString().slice(0, 19).replace("T", " ");
    console.log(`    ${ts}  ${(a.email ?? "—").padEnd(40)}  alias=${a.alias}  score=${a.competition_score}`);
  }
}

await closeSql();
