/**
 * Read-only: for each attendee scheduled for cleanup, check whether the
 * same auth user is also an admin/staff in public.users. Those auths
 * MUST NOT be deleted or admin/staff lose their access.
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId("sge-2026");

type Row = {
  auth_user_id: string;
  email: string | null;
  attendee_alias: string;
  public_user_role: string | null;
};

const rows = await sql<Row[]>`
  select
    a.auth_user_id,
    a.email,
    a.alias as attendee_alias,
    pu.role::text as public_user_role
  from public.attendees a
  left join auth.users u on u.id = a.auth_user_id
  left join public.users pu on pu.id = a.auth_user_id
  where a.event_id = ${eventId}
    and (u.raw_user_meta_data->>'source') is distinct from 'csv_import_sge2026'
`;

const admins = rows.filter((r) => r.public_user_role && r.public_user_role !== "attendee");

console.log(`Cleanup candidates total: ${rows.length}`);
console.log(`  …of those, also admin/staff in public.users: ${admins.length}\n`);

if (admins.length === 0) {
  console.log("No overlap. Safe to delete every cleanup candidate's auth row.");
} else {
  console.log("⚠️  These accounts will lose their admin/staff role if deleted:");
  console.log("─".repeat(80));
  for (const a of admins) {
    console.log(`  ${(a.email ?? "—").padEnd(45)}  role=${a.public_user_role}  alias=${a.attendee_alias}`);
  }
  console.log("\nRecommendation: add these emails to KEEP_AUTH below in cleanup-test-data.ts");
}

await closeSql();
