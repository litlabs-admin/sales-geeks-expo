import { backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { firstAttendee } from "./lib/phase5";
import { adminToken } from "./lib/phase7";
import { attendeeAccess, restoreEvent } from "./lib/phase8";

const eventId = await getEventId();
const attendees = await sql<{ id: string; auth_user_id: string }[]>`
  select id, auth_user_id
  from public.attendees
  where event_id = ${eventId}
  order by created_at asc
  limit 2
`;
const reopened = attendees[0] ?? (await firstAttendee(eventId));
const closed = attendees[1];
if (!closed) throw new Error("Need at least two attendees for reopen checks");

await sql`
  update public.events
  set lifecycle_state = 'post_event_archive',
      ends_at = now() - interval '11 days'
  where id = ${eventId}
`;

const override = await fetch(`${backendBaseUrl}/admin/access-overrides`, {
  method: "POST",
  headers: { authorization: `Bearer ${await adminToken()}`, "content-type": "application/json" },
  body: JSON.stringify({
    event_id: eventId,
    attendee_id: reopened.id,
    granted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    reason: "support reopen test"
  })
});
if (!override.ok) throw new Error(`Access override failed with ${override.status}`);

const reopenedAccess = await attendeeAccess(eventId, reopened.auth_user_id);
const closedAccess = await attendeeAccess(eventId, closed.auth_user_id);

if (!reopenedAccess.ok || closedAccess.status !== 403) {
  throw new Error(`Expected one reopened and one closed, saw reopened=${reopenedAccess.status} closed=${closedAccess.status}`);
}

await restoreEvent(eventId);
await closeSql();
console.log("Admin reopen checks passed.");
