import { closeSql, getEventId, sql } from "./lib/phase2";
import { firstAttendee } from "./lib/phase5";
import { attendeeAccess, restoreEvent } from "./lib/phase8";

const eventId = await getEventId();
const attendee = await firstAttendee(eventId);
await sql`
  delete from public.access_overrides
  where event_id = ${eventId}
    and attendee_id = ${attendee.id}
`;

await sql`
  update public.events
  set lifecycle_state = 'post_event_archive',
      ends_at = now() - interval '11 days'
  where id = ${eventId}
`;
let response = await attendeeAccess(eventId, attendee.auth_user_id);
if (response.status !== 403) throw new Error(`Expected 11-day archive access to be closed, saw ${response.status}`);

await sql`
  update public.events
  set ends_at = now() - interval '9 days'
  where id = ${eventId}
`;
response = await attendeeAccess(eventId, attendee.auth_user_id);
if (!response.ok) throw new Error(`Expected 9-day archive access to be open, saw ${response.status}`);

await restoreEvent(eventId);
await closeSql();
console.log("Archive 10-day expiry checks passed.");
