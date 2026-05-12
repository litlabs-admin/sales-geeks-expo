import { closeSql, getEventId, sql } from "./lib/phase2";
import { exportCsv, parseCsv } from "./lib/phase8";

const eventId = await getEventId();
const attendees = await sql<{ id: string }[]>`
  select id
  from public.attendees
  where event_id = ${eventId}
  order by created_at asc
  limit 10
`;
const sponsors = await sql<{ id: string }[]>`
  select id
  from public.sponsors
  where event_id = ${eventId}
  order by sort_order asc
  limit 1
`;
const sponsorId = sponsors[0]?.id;
if (!sponsorId || attendees.length < 10) throw new Error("Seed content and attendees before sponsor export checks");

await sql`delete from public.sponsor_interest where event_id = ${eventId} and sponsor_id = ${sponsorId}`;

for (const [index, attendee] of attendees.entries()) {
  await sql`
    insert into public.sponsor_interest (event_id, attendee_id, sponsor_id, consented, undone_at)
    values (${eventId}, ${attendee.id}, ${sponsorId}, ${index < 4}, null)
  `;
}

const result = await exportCsv("sponsor-leads", eventId);
const rows = parseCsv(result.text);

if (rows.length !== 4) {
  throw new Error(`Expected exactly 4 consenting sponsor leads, saw ${rows.length}\n${result.text}`);
}

await closeSql();
console.log("Sponsor consent export checks passed.");
