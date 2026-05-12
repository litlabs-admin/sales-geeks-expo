import { closeSql, getEventId, sql } from "./lib/phase2";
import { exportCsv, parseCsv } from "./lib/phase8";

const eventId = await getEventId();
const expected = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.attendees
  where event_id = ${eventId}
`;
const result = await exportCsv("attendees", eventId);
const rows = parseCsv(result.text);

for (const column of ["id", "email", "real_name", "business_name", "alias", "competition_score", "spendable_balance"]) {
  if (!result.text.startsWith("id,") || !result.text.split("\n")[0]?.includes(column)) {
    throw new Error(`Attendee export missing column ${column}`);
  }
}

if (rows.length !== expected[0]?.count) {
  throw new Error(`Expected ${expected[0]?.count} exported attendees, saw ${rows.length}`);
}

await closeSql();
console.log("Attendee export checks passed.");
