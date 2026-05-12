import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendeeToken } from "./lib/phase5";
import { attendees, clearRedemptions, closePhase6, postCalendly, rewardByName, setBalance } from "./lib/phase6";
import { backendBaseUrl } from "./lib/phase2";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
const reward = await rewardByName(eventId, "William%");
if (!attendee) throw new Error("Attendee missing");

await clearRedemptions(eventId, [attendee.id]);
await setBalance(attendee.id, 100);
await sql`update public.rewards set inventory = 3, cost = 75 where id = ${reward.id}`;

const token = await attendeeToken(attendee);
const claim = await fetch(`${backendBaseUrl}/rewards/william/claim`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ event_id: eventId, reward_id: reward.id, request_id: `william-webhook-${Date.now()}` })
});
if (!claim.ok) throw new Error(`William claim failed with ${claim.status}`);

const emailRows = await sql<{ email: string }[]>`select email from public.attendees where id = ${attendee.id}`;
const payload = { email: emailRows[0]?.email, calendly_event_id: `calendly-${Date.now()}` };
const first = await postCalendly("sge-2026", payload);
const replay = await postCalendly("sge-2026", payload);

if (!first.ok || !replay.ok) {
  throw new Error(`Webhook failed/replay failed: first=${first.status} replay=${replay.status}`);
}

const rows = await sql<{ spendable_balance: number; inventory: number; state: string; audits: number }[]>`
  select
    a.spendable_balance,
    r.inventory,
    rr.state,
    (select count(*)::int from public.audit_logs where action = 'william.completed' and target_id = rr.id::text) as audits
  from public.attendees a
  join public.redemption_records rr on rr.attendee_id = a.id
  join public.rewards r on r.id = rr.reward_id
  where a.id = ${attendee.id}
    and rr.reward_id = ${reward.id}
  order by rr.created_at desc
  limit 1
`;

if (rows[0]?.spendable_balance !== 25 || rows[0].inventory !== 2 || rows[0].state !== "completed" || rows[0].audits !== 1) {
  throw new Error(`William webhook was not idempotent: ${JSON.stringify(rows[0])}`);
}

await closePhase6();
await closeSql();
console.log("William webhook checks passed.");
