import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendees, clearRedemptions, closePhase6, postRedeem, rewardByName, setBalance } from "./lib/phase6";

const eventId = await getEventId();
const people = await attendees(eventId, 20);
const reward = await rewardByName(eventId, "Reward 2");

await clearRedemptions(eventId, people.map((attendee) => attendee.id));
await sql`update public.rewards set inventory = 1, cost = 10, per_attendee_limit = 1 where id = ${reward.id}`;
for (const attendee of people) await setBalance(attendee.id, 100);

const responses = await Promise.all(
  Array.from({ length: 50 }, (_, index) => {
    const attendee = people[index % people.length];
    if (!attendee) throw new Error("Attendee missing");
    return postRedeem({ attendee, reward, requestId: `oversell-${Date.now()}-${index}` });
  })
);
const bodies = await Promise.all(responses.map((response) => response.json() as Promise<{ result?: { status: string } }>));
const completed = bodies.filter((body) => body.result?.status === "completed").length;
const soldOut = bodies.filter((body) => body.result?.status === "sold_out" || body.result?.status === "limit_reached").length;

if (completed !== 1 || soldOut !== 49) {
  throw new Error(`Expected 1 completed and 49 blocked, saw completed=${completed} blocked=${soldOut}`);
}

await closePhase6();
await closeSql();
console.log("Redemption oversell checks passed.");
