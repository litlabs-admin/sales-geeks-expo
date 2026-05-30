import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import { parseAudience } from "@sgexpo/domain/notifications";
import { sql } from "../db/client";

type NotificationRow = {
  id: string;
  event_id: string;
  audience: unknown;
  scheduled_at: string | null;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }

  return value.trim();
}

function optionalDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HTTPException(400, { message: "scheduled_at is invalid" });
  return date.toISOString();
}

async function attendeesForAudience(notification: NotificationRow) {
  const audience = parseAudience(notification.audience);

  if (audience.type === "checked_in") {
    return sql<{ id: string }[]>`
      select id from public.attendees
      where event_id = ${notification.event_id}
        and checked_in_at is not null
    `;
  }

  if (audience.type === "verified") {
    return sql<{ id: string }[]>`
      select id from public.attendees
      where event_id = ${notification.event_id}
        and is_verified = true
    `;
  }

  return sql<{ id: string }[]>`
    select id from public.attendees
    where event_id = ${notification.event_id}
  `;
}

export async function fanoutNotification(notificationId: string) {
  const notifications = await sql<NotificationRow[]>`
    select id, event_id, audience, scheduled_at
    from public.notifications
    where id = ${notificationId}
    limit 1
  `;
  const notification = notifications[0];

  if (!notification) {
    throw new HTTPException(404, { message: "Notification not found" });
  }

  const attendees = await attendeesForAudience(notification);

  for (const attendee of attendees) {
    await sql`
      insert into public.notification_recipients (notification_id, attendee_id)
      values (${notification.id}, ${attendee.id})
      on conflict (notification_id, attendee_id) do nothing
    `;
  }

  await sql`
    update public.notifications
    set delivered_at = coalesce(delivered_at, now())
    where id = ${notification.id}
  `;

  return { delivered: attendees.length };
}

export async function fanoutDueNotifications() {
  const due = await sql<{ id: string }[]>`
    select id
    from public.notifications
    where delivered_at is null
      and (scheduled_at is null or scheduled_at <= now())
    order by scheduled_at asc nulls first, created_at asc
  `;

  let delivered = 0;
  for (const notification of due) {
    const result = await fanoutNotification(notification.id);
    delivered += result.delivered;
  }

  return { notifications: due.length, delivered };
}

export async function createNotification(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    title?: unknown;
    body?: unknown;
    audience?: unknown;
    scheduled_at?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const title = requiredString(body.title, "title");
  const notificationBody = requiredString(body.body, "body");
  const audience = parseAudience(body.audience);
  const scheduledAt = optionalDate(body.scheduled_at);

  const rows = await sql<{ id: string; scheduled_at: string | null }[]>`
    insert into public.notifications (
      event_id,
      title,
      body,
      audience,
      scheduled_at,
      created_by_user_id
    )
    values (
      ${eventId},
      ${title},
      ${notificationBody},
      ${JSON.stringify(audience)}::jsonb,
      ${scheduledAt},
      ${actor.id}
    )
    returning id, scheduled_at
  `;
  const notification = rows[0];

  if (!notification) {
    throw new HTTPException(500, { message: "Notification was not created" });
  }

  let fanout = null;
  if (!notification.scheduled_at || new Date(notification.scheduled_at).getTime() <= Date.now()) {
    fanout = await fanoutNotification(notification.id);
  }

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      'notification.created',
      'notification',
      ${notification.id},
      'admin_broadcast',
      ${JSON.stringify({ audience, scheduled_at: scheduledAt })}::jsonb
    )
  `;

  return c.json({ notification, fanout });
}

export async function processDueNotifications(c: Context) {
  return c.json(await fanoutDueNotifications());
}

export async function notificationFeed(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.query("event_id");
  const after = c.req.query("after");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const attendeeRows = await sql<{ id: string }[]>`
    select id
    from public.attendees
    where event_id = ${eventId}
      and auth_user_id = ${actor.id}
    limit 1
  `;
  const attendee = attendeeRows[0];

  if (!attendee) {
    throw new HTTPException(404, { message: "Attendee not found" });
  }

  const notifications = after
    ? await sql`
        select
          n.id,
          n.title,
          n.body,
          n.created_at,
          nr.delivered_at,
          nr.read_at
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where nr.attendee_id = ${attendee.id}
          and nr.delivered_at > ${after}
        order by nr.delivered_at desc
        limit 25
      `
    : await sql`
        select
          n.id,
          n.title,
          n.body,
          n.created_at,
          nr.delivered_at,
          nr.read_at
        from public.notification_recipients nr
        join public.notifications n on n.id = nr.notification_id
        where nr.attendee_id = ${attendee.id}
        order by nr.delivered_at desc
        limit 25
      `;

  return c.json({ notifications });
}

export async function markNotificationRead(c: Context) {
  const actor = c.get("actor") as Actor;
  const notificationId = requiredString(c.req.param("id"), "id");

  const rows = await sql`
    update public.notification_recipients nr
    set read_at = coalesce(read_at, now())
    from public.attendees a
    where nr.notification_id = ${notificationId}
      and nr.attendee_id = a.id
      and a.auth_user_id = ${actor.id}
    returning nr.notification_id, nr.read_at
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Notification recipient not found" });
  }

  return c.json({ recipient: rows[0] });
}

async function widget<T>(name: string, read: () => Promise<T>) {
  try {
    return {
      name,
      status: "ok",
      stale: false,
      data: await read()
    };
  } catch (error) {
    return {
      name,
      status: "unavailable",
      stale: true,
      data: null,
      error: error instanceof Error ? error.message : "Widget unavailable"
    };
  }
}

export async function opsDashboard(c: Context) {
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  // Live stats: small, fast counts that drive the TV-readable header tiles
  // (Registered, Checked In, OTP Verified, QR Scans, Total Connections).
  // Computed in parallel; degrade individually on failure so a single broken
  // counter never blanks the whole dashboard.
  const [attendeeStats, scanStats, connectionStats] = await Promise.all([
    sql<Array<{ total: number; checked_in: number; verified: number }>>`
      select
        count(*)::int as total,
        count(*) filter (where checked_in_at is not null)::int as checked_in,
        count(*) filter (where is_verified)::int as verified
      from public.attendees
      where event_id = ${eventId}
    `.catch(() => [{ total: 0, checked_in: 0, verified: 0 }]),
    sql<Array<{ total: number }>>`
      select count(*)::int as total from public.scan_records where event_id = ${eventId}
    `.catch(() => [{ total: 0 }]),
    sql<Array<{ total: number; last_hour: number; last_5m: number }>>`
      select
        count(*)::int as total,
        count(*) filter (where created_at > now() - interval '1 hour')::int as last_hour,
        count(*) filter (where created_at > now() - interval '5 minutes')::int as last_5m
      from public.attendee_connections
      where event_id = ${eventId}
    `.catch(() => [{ total: 0, last_hour: 0, last_5m: 0 }])
  ]);

  const stats = {
    total_attendees:        attendeeStats[0]?.total ?? 0,
    checked_in:             attendeeStats[0]?.checked_in ?? 0,
    verified:               attendeeStats[0]?.verified ?? 0,
    total_scans:            scanStats[0]?.total ?? 0,
    total_connections:      connectionStats[0]?.total ?? 0,
    connections_last_hour:  connectionStats[0]?.last_hour ?? 0,
    connections_last_5m:    connectionStats[0]?.last_5m ?? 0,
    health:                 "healthy" as const
  };

  const widgets = await Promise.all([
    widget("db_health", () => sql`select now() as checked_at, true as reachable`),
    widget("checkins", () => sql`select * from public.vw_ops_checkins where event_id = ${eventId}`),
    widget(
      "scans_per_minute",
      () => sql`select * from public.vw_ops_scans_per_minute where event_id = ${eventId} order by minute desc limit 10`
    ),
    widget("qr_activity", () => sql`select * from public.vw_ops_qr_activity where event_id = ${eventId} order by total_scans desc limit 10`),
    widget("recent_audit", () => sql`select * from public.vw_ops_recent_audit limit 20`)
  ]);

  return c.json({ stats, widgets });
}
