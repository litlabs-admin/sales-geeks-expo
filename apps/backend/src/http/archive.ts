import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import { isArchiveAccessOpen } from "@sgexpo/domain/archive";
import { sql } from "../db/client";

const lifecycleCache = new Map<string, { value: string | null; expiresAt: number }>();
const lifecycleCacheTtlMs = 30_000;

function eventIdFromRequest(c: Context) {
  return c.req.query("event_id");
}

async function eventIdFromBody(c: Context) {
  const cloned = c.req.raw.clone();
  const body = (await cloned.json().catch(() => ({}))) as { event_id?: unknown };
  return typeof body.event_id === "string" ? body.event_id : null;
}

async function shouldBypassArchiveCache(c: Context) {
  if (process.env.NODE_ENV === "production") return false;

  if (c.req.query("bypass_archive_cache") === "true") return true;

  const cloned = c.req.raw.clone();
  const body = (await cloned.json().catch(() => ({}))) as { bypass_archive_cache?: unknown };
  return body.bypass_archive_cache === true;
}

export async function archiveMutationGuard(c: Context, next: Next) {
  const actor = c.get("actor") as Actor;
  if (actor.role === "admin") {
    await next();
    return;
  }

  const eventId = eventIdFromRequest(c) ?? (await eventIdFromBody(c));
  if (!eventId) {
    await next();
    return;
  }

  const bypassCache = await shouldBypassArchiveCache(c);
  const cached = bypassCache ? null : lifecycleCache.get(eventId);
  let lifecycleState = cached && cached.expiresAt > Date.now() ? cached.value : null;

  if (!lifecycleState) {
    const rows = await sql<{ lifecycle_state: string }[]>`
      select lifecycle_state
      from public.events
      where id = ${eventId}
      limit 1
    `;
    lifecycleState = rows[0]?.lifecycle_state ?? null;
    lifecycleCache.set(eventId, { value: lifecycleState, expiresAt: Date.now() + lifecycleCacheTtlMs });
  }

  if (lifecycleState === "post_event_archive") {
    throw new HTTPException(403, { message: "Archive mode blocks attendee mutations" });
  }

  await next();
}

export async function assertAttendeeArchiveAccess(eventId: string, authUserId: string) {
  const rows = await sql<
    Array<{
      lifecycle_state: string;
      ends_at: string;
      attendee_id: string | null;
      granted_until: string | null;
    }>
  >`
    select
      e.lifecycle_state,
      e.ends_at,
      a.id as attendee_id,
      (
        select max(ao.granted_until)
        from public.access_overrides ao
        where ao.event_id = e.id
          and ao.attendee_id = a.id
      ) as granted_until
    from public.events e
    left join public.attendees a
      on a.event_id = e.id
      and a.auth_user_id = ${authUserId}
    where e.id = ${eventId}
    limit 1
  `;
  const row = rows[0];

  if (!row || row.lifecycle_state !== "post_event_archive") {
    return;
  }

  if (
    !isArchiveAccessOpen({
      eventEndsAt: row.ends_at,
      overrideUntil: row.granted_until
    })
  ) {
    throw new HTTPException(403, { message: "Archive access window is closed" });
  }
}

export async function createAccessOverride(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    attendee_id?: unknown;
    granted_until?: unknown;
    reason?: unknown;
  };

  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  const attendeeId = typeof body.attendee_id === "string" ? body.attendee_id : "";
  const grantedUntil = typeof body.granted_until === "string" ? body.granted_until : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!eventId || !attendeeId || !grantedUntil || !reason) {
    throw new HTTPException(400, { message: "event_id, attendee_id, granted_until, and reason are required" });
  }

  const rows = await sql`
    insert into public.access_overrides (
      event_id,
      attendee_id,
      granted_until,
      granted_by_user_id,
      reason
    )
    values (${eventId}, ${attendeeId}, ${grantedUntil}, ${actor.id}, ${reason})
    returning *
  `;

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      'archive.access_override',
      'attendee',
      ${attendeeId},
      ${reason},
      ${JSON.stringify({ event_id: eventId, granted_until: grantedUntil })}::jsonb
    )
  `;

  return c.json({ override: rows[0] });
}
