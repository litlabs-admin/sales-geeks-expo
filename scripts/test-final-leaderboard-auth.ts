import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { firstAttendee } from "./lib/phase5";
import { attendeeToken } from "./lib/phase5";
import { restoreEvent } from "./lib/phase8";

const eventId = await getEventId();
await sql`update public.events set lifecycle_state = 'post_event_archive' where id = ${eventId}`;

const loggedOut = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`);
if (loggedOut.status !== 401) {
  throw new Error(`Expected logged-out archive leaderboard to be 401, saw ${loggedOut.status}`);
}

const attendee = await firstAttendee(eventId);
const token = await attendeeToken(attendee);
const loggedIn = await fetch(`${backendBaseUrl}/leaderboard?event_id=${eventId}`, {
  headers: { authorization: `Bearer ${token}` }
});
if (!loggedIn.ok) throw new Error(`Expected logged-in archive leaderboard to work, saw ${loggedIn.status}`);

await restoreEvent(eventId);
await closeSql();
console.log("Archive leaderboard auth checks passed.");
