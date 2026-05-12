import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { adminToken } from "./lib/phase7";

const eventId = await getEventId();

await sql`
  update public.attendees
  set checked_in_at = case when alias in ('Seed-1', 'Seed-2', 'Seed-3') then now() else null end
  where event_id = ${eventId}
`;

const expected = await sql<{ total_attendees: number; checked_in: number }[]>`
  select
    count(*)::int as total_attendees,
    count(*) filter (where checked_in_at is not null)::int as checked_in
  from public.attendees
  where event_id = ${eventId}
`;

const response = await fetch(`${backendBaseUrl}/admin/ops?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${await adminToken()}` }
});
if (!response.ok) throw new Error(`Ops returned ${response.status}`);

const body = (await response.json()) as {
  widgets: Array<{ name: string; status: string; data: Array<{ total_attendees: number; checked_in: number }> | null }>;
};
const checkins = body.widgets.find((widget) => widget.name === "checkins");
const row = checkins?.data?.[0];

if (checkins?.status !== "ok" || row?.total_attendees !== expected[0]?.total_attendees || row.checked_in !== expected[0].checked_in) {
  throw new Error(`Ops checkins did not match: ${JSON.stringify(body)}`);
}

await closeSql();
console.log("Ops dashboard checks passed.");
