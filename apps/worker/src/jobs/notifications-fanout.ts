import { parseAudience } from "@sgexpo/domain/notifications";
import { sql } from "../db";

export async function fanoutNotification(notificationId: string) {
  const rows = await sql<{ id: string; event_id: string; audience: unknown }[]>`
    select id, event_id, audience
    from public.notifications
    where id = ${notificationId}
    limit 1
  `;
  const notification = rows[0];
  if (!notification) return { delivered: 0 };

  const audience = parseAudience(notification.audience);
  const attendees =
    audience.type === "checked_in"
      ? await sql<{ id: string }[]>`
          select id from public.attendees
          where event_id = ${notification.event_id}
            and checked_in_at is not null
        `
      : audience.type === "verified"
        ? await sql<{ id: string }[]>`
            select id from public.attendees
            where event_id = ${notification.event_id}
              and is_verified = true
          `
        : await sql<{ id: string }[]>`
            select id from public.attendees
            where event_id = ${notification.event_id}
          `;

  for (const attendee of attendees) {
    await sql`
      insert into public.notification_recipients (notification_id, attendee_id)
      values (${notification.id}, ${attendee.id})
      on conflict (notification_id, attendee_id) do nothing
    `;
  }

  await sql`update public.notifications set delivered_at = coalesce(delivered_at, now()) where id = ${notification.id}`;
  return { delivered: attendees.length };
}
