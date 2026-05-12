import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendees, clearRedemptions, closePhase6, postRedeem, rewardByName, setBalance } from "./lib/phase6";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
const reward = await rewardByName(eventId, "Reward 3");
if (!attendee) throw new Error("Attendee missing");

await clearRedemptions(eventId, [attendee.id]);
await setBalance(attendee.id, 500);
await sql`update public.rewards set inventory = 10, cost = 10, per_attendee_limit = 2 where id = ${reward.id}`;

const responses = await Promise.all(
  Array.from({ length: 5 }, (_, index) =>
    postRedeem({ attendee, reward, requestId: `limit-${Date.now()}-${index}` })
  )
);
const bodies = await Promise.all(responses.map((response) => response.json() as Promise<{ result?: { status: string } }>));
const completed = bodies.filter((body) => body.result?.status === "completed").length;
const limited = bodies.filter((body) => body.result?.status === "limit_reached").length;

if (completed !== 2 || limited !== 3) {
  throw new Error(`Expected 2 completed and 3 limit_reached, saw ${JSON.stringify(bodies)}`);
}

await closePhase6();
await closeSql();
console.log("Redemption limit checks passed.");
