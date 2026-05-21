import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import { sql } from "../db/client";
import { replayPendingScans } from "./scoring";
import { assertAttendeeArchiveAccess } from "./archive";
import { createRedisClient } from "../redis";

const redis = createRedisClient();

async function ensureRedis() {
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }
}

export async function invalidateAttendeeMeCache(eventId: string, authUserId: string) {
  try {
    await ensureRedis();
    await redis.del(`attendee:me:${eventId}:${authUserId}`);
  } catch { /* non-fatal */ }
}

type AttendeeInput = {
  event_id?: unknown;
  real_name?: unknown;
  business_name?: unknown;
  phone?: unknown;
  email?: unknown;
  alias?: unknown;
};

function validateAlias(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: "Alias is required" });
  }
  const alias = value.trim();
  if (alias.length < 2 || alias.length > 24) {
    throw new HTTPException(400, { message: "Alias must be 2–24 characters" });
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(alias)) {
    throw new HTTPException(400, {
      message: "Alias may only contain letters, numbers, spaces, hyphens and underscores"
    });
  }
  return alias;
}

type PendingScanInput = {
  event_id?: unknown;
  qr_code_id?: unknown;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }

  return value.trim();
}

function aliasFor(actor: Actor) {
  return `Geek-${actor.id.slice(0, 8)}`;
}

async function ensureAutoCheckIn(eventId: string, authUserId: string) {
  await sql`
    update public.attendees attendee
    set checked_in_at = now(),
        updated_at = now()
    from public.events event
    where attendee.event_id = event.id
      and attendee.event_id = ${eventId}
      and attendee.auth_user_id = ${authUserId}
      and event.lifecycle_state = 'event_day'
      and attendee.checked_in_at is null
  `;
}

export async function upsertAttendee(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as AttendeeInput;
  const eventId = requiredString(body.event_id, "event_id");

  if (body.email !== undefined) {
    throw new HTTPException(403, { message: "Email cannot be set through attendee upsert" });
  }

  const rows = await sql<Array<{ id: string }>>`
    insert into public.attendees (
      event_id,
      auth_user_id,
      email,
      real_name,
      business_name,
      phone,
      alias,
      is_verified
    )
    values (
      ${eventId},
      ${actor.id},
      ${actor.email ?? null},
      ${optionalString(body.real_name)},
      ${optionalString(body.business_name)},
      ${optionalString(body.phone)},
      ${aliasFor(actor)},
      ${Boolean(actor.email)}
    )
    on conflict (event_id, auth_user_id) do update
      set real_name = coalesce(excluded.real_name, public.attendees.real_name),
          business_name = coalesce(excluded.business_name, public.attendees.business_name),
          phone = coalesce(excluded.phone, public.attendees.phone),
          email = coalesce(public.attendees.email, excluded.email),
          is_verified = public.attendees.is_verified or excluded.is_verified,
          updated_at = now()
    returning *
  `;

  await ensureAutoCheckIn(eventId, actor.id);

  await replayPendingScans({
    eventId,
    actor,
    attendeeId: rows[0].id
  });

  const refreshed = await sql`
    select *
    from public.attendees
    where id = ${rows[0].id}
  `;

  return c.json({ attendee: refreshed[0] });
}

export async function updateAttendee(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as AttendeeInput;
  const eventId = requiredString(body.event_id, "event_id");

  if (body.email !== undefined) {
    throw new HTTPException(403, { message: "Email is immutable" });
  }

  const aliasValue = body.alias !== undefined ? validateAlias(body.alias) : null;

  let rows;
  try {
    rows = await sql`
      update public.attendees
      set real_name = coalesce(${optionalString(body.real_name)}, real_name),
          business_name = coalesce(${optionalString(body.business_name)}, business_name),
          phone = coalesce(${optionalString(body.phone)}, phone),
          alias = coalesce(${aliasValue}, alias),
          alias_set = alias_set or ${aliasValue !== null},
          updated_at = now()
      where event_id = ${eventId}
        and auth_user_id = ${actor.id}
      returning *
    `;
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw new HTTPException(409, { message: "That alias is already taken. Please choose another." });
    }
    throw error;
  }

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Attendee not found" });
  }

  await ensureAutoCheckIn(eventId, actor.id);

  return c.json({ attendee: rows[0] });
}

export async function getAttendee(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  await assertAttendeeArchiveAccess(eventId, actor.id);

  const cacheKey = `attendee:me:${eventId}:${actor.id}`;

  try {
    await ensureRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { attendee: { checked_in_at: string | null } | null };
      if (parsed.attendee?.checked_in_at) {
        return c.json(parsed);
      }
    }
  } catch { /* non-fatal */ }

  await ensureAutoCheckIn(eventId, actor.id);

  const rows = await sql`
    select *
    from public.attendees
    where event_id = ${eventId}
      and auth_user_id = ${actor.id}
    limit 1
  `;

  const payload = { attendee: rows[0] ?? null };

  try {
    await ensureRedis();
    await redis.set(cacheKey, JSON.stringify(payload), "EX", 10);
  } catch { /* non-fatal */ }

  return c.json(payload);
}

export async function recordPendingScan(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as PendingScanInput;
  const eventId = requiredString(body.event_id, "event_id");
  const qrCodeId = requiredString(body.qr_code_id, "qr_code_id");

  await sql`
    insert into public.pending_scans (event_id, auth_user_id, qr_code_id)
    values (${eventId}, ${actor.id}, ${qrCodeId})
    on conflict (auth_user_id, qr_code_id) do nothing
  `;

  await ensureAutoCheckIn(eventId, actor.id);

  return c.json({ ok: true });
}

export async function getAttendeeScans(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const attendeeRows = await sql<Array<{ id: string }>>`
    select id from public.attendees
    where event_id = ${eventId} and auth_user_id = ${actor.id}
    limit 1
  `;

  const attendee = attendeeRows[0];
  if (!attendee) {
    return c.json({ scans: [] });
  }

  const scans = await sql`
    select
      sr.id,
      sr.awarded_at,
      sr.points_competition,
      sr.points_spendable,
      json_build_object(
        'campaign_name', q.campaign_name,
        'type', q.type,
        'reason', q.reason
      ) as qr_code
    from public.scan_records sr
    join public.qr_codes q on q.id = sr.qr_code_id
    where sr.attendee_id = ${attendee.id}
    order by sr.awarded_at desc
    limit 50
  `;

  return c.json({ scans });
}

