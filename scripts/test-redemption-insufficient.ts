import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendees, clearRedemptions, closePhase6, postRedeem, rewardByName, setBalance } from "./lib/phase6";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
const reward = await rewardByName(eventId, "Reward 5");
if (!attendee) throw new Error("Attendee missing");

await clearRedemptions(eventId, [attendee.id]);
await setBalance(attendee.id, 1);

const response = await postRedeem({ attendee, reward, requestId: `insufficient-${Date.now()}` });
const body = (await response.json()) as { result?: { status: string } };

if (response.status !== 400 || body.result?.status !== "insufficient_balance") {
  throw new Error(`Expected insufficient_balance, saw ${response.status} ${JSON.stringify(body)}`);
}

const rows = await sql<{ spendable_balance: number; count: number }[]>`
  select
    a.spendable_balance,
    (select count(*)::int from public.redemption_records where attendee_id = ${attendee.id} and reward_id = ${reward.id}) as count
  from public.attendees a
  where a.id = ${attendee.id}
`;

if (rows[0]?.spendable_balance !== 1 || rows[0].count !== 0) {
  throw new Error(`Insufficient balance changed state: ${JSON.stringify(rows[0])}`);
}

await closePhase6();
await closeSql();
console.log("Insufficient redemption checks passed.");
