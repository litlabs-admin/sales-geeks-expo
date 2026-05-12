import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendeeToken } from "./lib/phase5";
import { attendees, clearRedemptions, closePhase6, rewardByName, setBalance } from "./lib/phase6";
import { backendBaseUrl } from "./lib/phase2";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
const reward = await rewardByName(eventId, "William%");
if (!attendee) throw new Error("Attendee missing");

await clearRedemptions(eventId, [attendee.id]);
await setBalance(attendee.id, 100);

const token = await attendeeToken(attendee);
const response = await fetch(`${backendBaseUrl}/rewards/william/claim`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ event_id: eventId, reward_id: reward.id, request_id: `william-claim-${Date.now()}` })
});
const body = (await response.json()) as { result?: { status: string } };

if (!response.ok || body.result?.status !== "pending_booking") {
  throw new Error(`Expected pending William claim, saw ${response.status} ${JSON.stringify(body)}`);
}

const rows = await sql<{ spendable_balance: number; state: string; holds: number }[]>`
  select
    a.spendable_balance,
    rr.state,
    (select count(*)::int from public.redemption_holds where attendee_id = ${attendee.id} and reward_id = ${reward.id}) as holds
  from public.attendees a
  join public.redemption_records rr on rr.attendee_id = a.id
  where a.id = ${attendee.id}
    and rr.reward_id = ${reward.id}
  order by rr.created_at desc
  limit 1
`;

if (rows[0]?.spendable_balance !== 100 || rows[0].state !== "pending_booking" || rows[0].holds !== 1) {
  throw new Error(`William claim deducted early or missed hold: ${JSON.stringify(rows[0])}`);
}

await closePhase6();
await closeSql();
console.log("William claim checks passed.");
