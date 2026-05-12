import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendees, clearRedemptions, closePhase6, postRedeem, rewardByName, setBalance } from "./lib/phase6";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
const reward = await rewardByName(eventId, "Reward 1");
if (!attendee) throw new Error("Attendee missing");

await clearRedemptions(eventId, [attendee.id]);
await setBalance(attendee.id, 100);

const before = await sql<{ inventory: number }[]>`select inventory from public.rewards where id = ${reward.id}`;
const response = await postRedeem({ attendee, reward, requestId: `happy-${Date.now()}` });
const body = (await response.json()) as { result?: { status: string } };

if (!response.ok || body.result?.status !== "completed") {
  throw new Error(`Expected completed redemption, saw ${response.status} ${JSON.stringify(body)}`);
}

const rows = await sql<{ spendable_balance: number; inventory: number; state: string }[]>`
  select a.spendable_balance, r.inventory, rr.state
  from public.attendees a, public.rewards r, public.redemption_records rr
  where a.id = ${attendee.id}
    and r.id = ${reward.id}
    and rr.attendee_id = a.id
    and rr.reward_id = r.id
  order by rr.created_at desc
  limit 1
`;
const result = rows[0];

if (result?.spendable_balance !== 90 || result.inventory !== before[0].inventory - 1 || result.state !== "completed") {
  throw new Error(`Unexpected redemption state: ${JSON.stringify(result)}`);
}

await closePhase6();
await closeSql();
console.log("Happy redemption checks passed.");
