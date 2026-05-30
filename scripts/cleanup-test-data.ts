/**
 * Cleanup test/fake data for sge-2026 ahead of the live event.
 *
 * Removes:
 *   - Attendees NOT marked source=csv_import_sge2026 in auth user metadata
 *     (i.e. anyone who didn't come from the Forumm CSV import)
 *   - Businesses whose name is not in the canonical SPONSORS list
 *     (eight demo/placeholder businesses created by older content seeds)
 *   - Each attendee's dependent rows: attendee_connections (no FK cascade),
 *     then their auth.users row (which cascades attendees + pending_scans
 *     + the rest)
 *   - Each business's qr_codes (no FK to businesses(id), so manual)
 *
 * Keeps:
 *   - All 484 CSV-imported attendees + their scores and connections
 *   - All 68 real sponsor businesses + their printed QR codes (points
 *     intact)
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-test-data.ts             # DRY-RUN (default)
 *   pnpm tsx scripts/cleanup-test-data.ts --apply     # actually delete
 */

import { closeSql, getEventId, sql, supabaseAdmin } from "./lib/phase2";

const EVENT_SLUG = "sge-2026";
const APPLY = process.argv.includes("--apply");

// Accounts that are ALSO admin/staff in public.users — delete only their
// attendee row (so they're off the leaderboard) but keep their auth.users
// entry intact so they don't lose admin access on event day.
// Auto-detected via check-admin-overlap.ts; bake in the addresses here.
const KEEP_AUTH = new Set([
  "admin+sgexpo@litlabs.io",
  "staff+sgexpo@litlabs.io",
  "engineering@litlabs.io",
  "arbazs98519@gmail.com",
]);

// Canonical sponsor names — must exactly match scripts/seed-sponsor-qrs.ts.
// Keeping this duplicated (rather than importing) keeps the cleanup script
// safe to run even if the seed script changes later.
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
console.log(`Mode: ${APPLY ? "🔴 APPLY (will delete)" : "🟢 DRY-RUN (no writes)"}\n`);
console.log(`Event sge-2026 → ${eventId}\n`);

/* ── 1. Attendees to delete ────────────────────────────────────────────── */
type AttendeeRow = {
  id: string;
  auth_user_id: string;
  email: string | null;
  alias: string;
  competition_score: number;
  source: string | null;
};

const allAttendees = await sql<AttendeeRow[]>`
  select
    a.id, a.auth_user_id, a.email, a.alias, a.competition_score,
    (u.raw_user_meta_data->>'source') as source
  from public.attendees a
  left join auth.users u on u.id = a.auth_user_id
  where a.event_id = ${eventId}
`;

const attendeesToDelete = allAttendees.filter(
  (a) => a.source !== "csv_import_sge2026"
);
const attendeesToKeep = allAttendees.length - attendeesToDelete.length;

console.log(`Attendees in DB:                 ${allAttendees.length}`);
console.log(`  → keep (csv_import_sge2026):   ${attendeesToKeep}`);
console.log(`  → delete (test/dev/walk-in):   ${attendeesToDelete.length}`);
if (attendeesToDelete.length > 0) {
  console.log("\n  Sample of attendees to delete (first 20):");
  for (const a of attendeesToDelete.slice(0, 20)) {
    console.log(`    ${(a.email ?? "—").padEnd(40)} alias=${a.alias.padEnd(28)} score=${a.competition_score}`);
  }
  if (attendeesToDelete.length > 20) {
    console.log(`    ... and ${attendeesToDelete.length - 20} more`);
  }
}

/* ── 2. Businesses to delete ───────────────────────────────────────────── */
type BusinessRow = {
  id: string;
  name: string;
  contact_email: string | null;
};

const allBusinesses = await sql<BusinessRow[]>`
  select id, name, contact_email
  from public.businesses
  where event_id = ${eventId}
`;

const businessesToDelete = allBusinesses.filter((b) => !SPONSORS.has(b.name));
const businessesToKeep = allBusinesses.length - businessesToDelete.length;

console.log(`\nBusinesses in DB:                ${allBusinesses.length}`);
console.log(`  → keep (in SPONSORS list):     ${businessesToKeep}`);
console.log(`  → delete (not in list):        ${businessesToDelete.length}`);
if (businessesToDelete.length > 0) {
  console.log("\n  Businesses to delete:");
  for (const b of businessesToDelete) {
    console.log(`    ${b.name.padEnd(40)} ${b.contact_email ?? "—"}`);
  }
}

/* ── Bail out for dry run ──────────────────────────────────────────────── */
if (!APPLY) {
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log("Dry-run complete. No data was changed.");
  console.log("Re-run with --apply to perform the deletions.");
  await closeSql();
  process.exit(0);
}

if (attendeesToDelete.length === 0 && businessesToDelete.length === 0) {
  console.log("\nNothing to do — DB is already clean.");
  await closeSql();
  process.exit(0);
}

/* ── 3. Apply deletes ──────────────────────────────────────────────────── */
console.log("\n🔴 APPLY — deleting now...\n");

let totalAttendeeAuthDeleted = 0;
let totalAttendeeFallbackDeleted = 0;
let totalConnectionsDeleted = 0;
let totalQrDeleted = 0;
let totalBusinessesDeleted = 0;

if (attendeesToDelete.length > 0) {
  const attendeeIds = attendeesToDelete.map((a) => a.id);

  // attendee_connections is created at runtime and lacks ON DELETE CASCADE
  // from attendees, so drop them first to avoid FK violations.
  const conns = await sql`
    delete from public.attendee_connections
    where scanner_id = any(${attendeeIds}::uuid[])
       or scanned_id = any(${attendeeIds}::uuid[])
  `;
  totalConnectionsDeleted = conns.count;
  console.log(`  ✓ attendee_connections removed: ${conns.count}`);

  // For each candidate:
  //   - If email is in KEEP_AUTH (account is also admin/staff): delete the
  //     attendee row only, leaving auth.users untouched so admin/staff
  //     access on event day still works.
  //   - Otherwise: delete the auth.users row → cascades the attendee row,
  //     pending_scans, scan_records, sponsor_interest, redemption_records,
  //     notifications, etc.
  let keptAuthCount = 0;
  for (const a of attendeesToDelete) {
    const email = (a.email ?? "").toLowerCase();
    if (KEEP_AUTH.has(email)) {
      await sql`delete from public.attendees where id = ${a.id}`;
      keptAuthCount += 1;
      continue;
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(a.auth_user_id);
    if (error) {
      await sql`delete from public.attendees where id = ${a.id}`;
      totalAttendeeFallbackDeleted += 1;
    } else {
      totalAttendeeAuthDeleted += 1;
    }
  }
  console.log(`  ✓ auth.users deleted:           ${totalAttendeeAuthDeleted}`);
  if (totalAttendeeFallbackDeleted > 0) {
    console.log(`  ✓ attendees deleted (fallback): ${totalAttendeeFallbackDeleted}`);
  }
  if (keptAuthCount > 0) {
    console.log(`  ✓ attendee row only (admin/staff): ${keptAuthCount}`);
  }
}

if (businessesToDelete.length > 0) {
  const businessIds = businessesToDelete.map((b) => b.id);

  // qr_codes.owner_id has no FK constraint to businesses(id), so explicit.
  const qr = await sql`
    delete from public.qr_codes
    where event_id = ${eventId}
      and owner_type = 'business'
      and owner_id = any(${businessIds}::uuid[])
  `;
  totalQrDeleted = qr.count;
  console.log(`  ✓ business qr_codes deleted:    ${qr.count}`);

  const biz = await sql`
    delete from public.businesses
    where id = any(${businessIds}::uuid[])
  `;
  totalBusinessesDeleted = biz.count;
  console.log(`  ✓ businesses deleted:           ${biz.count}`);
}

await closeSql();

console.log("\n──────────────────────────────────────────────────────────────────────");
console.log("Cleanup complete.");
console.log(`  Attendees removed:      ${totalAttendeeAuthDeleted + totalAttendeeFallbackDeleted}`);
console.log(`  Connections cleared:    ${totalConnectionsDeleted}`);
console.log(`  Businesses removed:     ${totalBusinessesDeleted}`);
console.log(`  Business QR codes cut:  ${totalQrDeleted}`);
console.log("\nReal Forumm attendees + real sponsors are untouched.");
