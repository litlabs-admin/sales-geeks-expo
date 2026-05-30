import { closeSql, getEventId, sql } from "./lib/phase2";

const eid = await getEventId("sge-2026");
type Row = { title: string; t: string };
const rows = await sql<Row[]>`
  select title, to_char(starts_at at time zone 'Europe/London','HH24:MI') as t
  from public.agenda_sessions
  where event_id = ${eid}
  order by starts_at
`;
console.log(`Event ${eid} agenda — ${rows.length} sessions:`);
for (const s of rows) console.log(`  ${s.t}  ${s.title}`);
await closeSql();
