import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { adminToken } from "./lib/phase7";

const eventId = await getEventId();

await sql`drop view if exists public.vw_ops_low_stock`;

const response = await fetch(`${backendBaseUrl}/admin/ops?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${await adminToken()}` }
});
if (!response.ok) throw new Error(`Ops degraded response returned ${response.status}`);

const body = (await response.json()) as {
  widgets: Array<{ name: string; status: string }>;
};
const lowStock = body.widgets.find((widget) => widget.name === "low_stock");
const checkins = body.widgets.find((widget) => widget.name === "checkins");

if (lowStock?.status !== "unavailable" || checkins?.status !== "ok") {
  throw new Error(`Ops did not degrade per-widget: ${JSON.stringify(body)}`);
}

await sql`
  create or replace view public.vw_ops_low_stock as
  select
    event_id,
    id as reward_id,
    name,
    inventory
  from public.rewards
  where inventory <= 2
  order by inventory asc, name asc
`;
await sql`grant select on public.vw_ops_low_stock to anon, authenticated`;

await closeSql();
console.log("Ops degradation checks passed.");
