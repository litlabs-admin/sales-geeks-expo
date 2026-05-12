import { backendBaseUrl, closeSql, getEventId } from "./lib/phase2";
import { adminToken } from "./lib/phase7";
import { blockedRedeem, blockedScan, restoreEvent } from "./lib/phase8";
import { sql } from "./lib/phase2";

const eventId = await getEventId();
await sql`update public.events set lifecycle_state = 'post_event_archive' where id = ${eventId}`;

const scan = await blockedScan(eventId);
const redeem = await blockedRedeem(eventId);

if (scan.status !== 403 || redeem.status !== 403) {
  throw new Error(`Expected archive to block scan/redeem, saw scan=${scan.status} redeem=${redeem.status}`);
}

const admin = await fetch(`${backendBaseUrl}/admin/notifications`, {
  method: "POST",
  headers: { authorization: `Bearer ${await adminToken()}`, "content-type": "application/json" },
  body: JSON.stringify({ event_id: eventId, title: "Archive admin", body: "Admin still mutates", audience: { type: "all" } })
});
if (!admin.ok) throw new Error(`Expected admin mutation to remain allowed, saw ${admin.status}`);

await restoreEvent(eventId);
await closeSql();
console.log("Archive transition checks passed.");
