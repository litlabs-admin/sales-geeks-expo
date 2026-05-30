import { closeSql, getEventId, sql } from "./lib/phase2";

const eid = await getEventId("sge-2026");
type Row = { points: number; owner_type: string; count: number };
const rows = await sql<Row[]>`
  select points, owner_type, count(*)::int as count
  from public.qr_codes
  where event_id = ${eid}
  group by points, owner_type
  order by owner_type, points
`;
console.log("QR points distribution for sge-2026:");
console.log("  owner_type     points   count");
for (const r of rows) console.log(`  ${(r.owner_type ?? "(null)").padEnd(14)} ${String(r.points).padStart(6)}   ${r.count}`);
await closeSql();
