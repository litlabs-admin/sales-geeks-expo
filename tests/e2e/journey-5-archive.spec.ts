import { expect, test } from "@playwright/test";
import { backendBaseUrl, getEventId, sql } from "../../scripts/lib/phase2";
import { firstAttendee } from "../../scripts/lib/phase5";
import { adminToken } from "../../scripts/lib/phase7";
import { attendeeAccess, blockedScan, restoreEvent } from "../../scripts/lib/phase8";

test("archive closes attendee mutation and admin can reopen one attendee", async () => {
  const eventId = await getEventId();
  const reopened = await firstAttendee(eventId);
  await sql`
    delete from public.access_overrides
    where event_id = ${eventId}
      and attendee_id = ${reopened.id}
  `;

  try {
    await sql`
      update public.events
      set lifecycle_state = 'post_event_archive',
          ends_at = now() - interval '11 days'
      where id = ${eventId}
    `;

    const blocked = await blockedScan(eventId);
    expect(blocked.status).toBe(403);

    const closedAccess = await attendeeAccess(eventId, reopened.auth_user_id);
    expect(closedAccess.status).toBe(403);

    const override = await fetch(`${backendBaseUrl}/admin/access-overrides`, {
      method: "POST",
      headers: { authorization: `Bearer ${await adminToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        attendee_id: reopened.id,
        granted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reason: "uat archive reopen"
      })
    });
    expect(override.status).toBe(200);

    const reopenedAccess = await attendeeAccess(eventId, reopened.auth_user_id);
    expect(reopenedAccess.status).toBe(200);
  } finally {
    await restoreEvent(eventId);
  }
});
