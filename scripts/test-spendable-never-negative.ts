import { closeSql, getEventId, sql } from "./lib/phase2";
import { attendees, closePhase6, setBalance } from "./lib/phase6";

const eventId = await getEventId();
const [attendee] = await attendees(eventId, 1);
if (!attendee) throw new Error("Attendee missing");

await setBalance(attendee.id, 0);

let caught = false;
try {
  await sql`
    update public.attendees
    set spendable_balance = -1
    where id = ${attendee.id}
  `;
} catch (error) {
  caught = (error as { code?: string }).code === "23514";
}

if (!caught) {
  throw new Error("Expected spendable balance CHECK constraint to reject a negative balance");
}

await closePhase6();
await closeSql();
console.log("Spendable non-negative constraint checks passed.");
