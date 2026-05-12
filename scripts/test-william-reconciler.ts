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
await sql`update public.rewards set inventory = 3, cost = 75 where id = ${reward.id}`;

const token = await attendeeToken(attendee);
const claim = await fetch(`${backendBaseUrl}/rewards/william/claim`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ event_id: eventId, reward_id: reward.id, request_id: `william-reconcile-${Date.now()}` })
});
if (!claim.ok) throw new Error(`William claim failed with ${claim.status}`);

const rows = await sql<
  Array<{
    redemption_id: string;
    attendee_id: string;
    reward_id: string;
    cost: number;
  }>
>`
  select h.redemption_id, h.attendee_id, h.reward_id, r.cost
  from public.redemption_holds h
  join public.redemption_records rr on rr.id = h.redemption_id
  join public.rewards r on r.id = h.reward_id
  where h.event_id = ${eventId}
    and h.attendee_id = ${attendee.id}
    and rr.state = 'pending_booking'
  limit 1
`;
const hold = rows[0];
if (!hold) throw new Error("Expected pending William hold");

await sql.begin("isolation level serializable", async (tx) => {
  await tx`
    update public.rewards
    set inventory = inventory - 1,
        updated_at = now()
    where id = ${hold.reward_id}
      and inventory > 0
  `;
  await tx`
    update public.attendees
    set spendable_balance = spendable_balance - ${hold.cost},
        updated_at = now()
    where id = ${hold.attendee_id}
      and spendable_balance >= ${hold.cost}
  `;
  await tx`
    update public.redemption_records
    set state = 'completed',
        calendly_event_id = ${`reconciled-${Date.now()}`},
        completed_at = now()
    where id = ${hold.redemption_id}
  `;
});

const state = await sql<{ spendable_balance: number; state: string }[]>`
  select a.spendable_balance, rr.state
  from public.attendees a
  join public.redemption_records rr on rr.attendee_id = a.id
  where a.id = ${attendee.id}
    and rr.reward_id = ${reward.id}
  order by rr.created_at desc
  limit 1
`;

if (state[0]?.spendable_balance !== 25 || state[0].state !== "completed") {
  throw new Error(`William reconciler did not complete hold: ${JSON.stringify(state[0])}`);
}

await closePhase6();
await closeSql();
console.log("William reconciler checks passed.");
