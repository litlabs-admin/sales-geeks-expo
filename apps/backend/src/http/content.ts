import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import { sql } from "../db/client";

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }

  return value.trim();
}

async function attendeeForActor(eventId: string, authUserId: string) {
  const rows = await sql<{ id: string; competition_score: number }[]>`
    select id, competition_score
    from public.attendees
    where event_id = ${eventId}
      and auth_user_id = ${authUserId}
    limit 1
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Attendee not found" });
  }

  return rows[0];
}

export async function agenda(c: Context) {
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const sessions = await sql`
    select
      id,
      event_id,
      title,
      description,
      stage,
      category,
      type,
      starts_at,
      ends_at,
      speaker_id,
      sponsor_id,
      case
        when now() between starts_at and ends_at then 'live'
        when starts_at > now() then 'upcoming'
        else 'ended'
      end as status
    from public.agenda_sessions
    where event_id = ${eventId}
    order by starts_at asc
  `;

  return c.json({ sessions });
}

export async function toggleSponsorInterest(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    sponsor_id?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const sponsorId = requiredString(body.sponsor_id, "sponsor_id");
  const attendee = await attendeeForActor(eventId, actor.id);

  const rows = await sql`
    insert into public.sponsor_interest (event_id, attendee_id, sponsor_id, consented, undone_at)
    values (${eventId}, ${attendee.id}, ${sponsorId}, false, null)
    on conflict (event_id, attendee_id, sponsor_id) do update
      set undone_at = null,
          consented = false,
          updated_at = now()
    returning *
  `;

  return c.json({ interest: rows[0], score: attendee.competition_score });
}

export async function consentSponsorInterest(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    sponsor_id?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const sponsorId = requiredString(body.sponsor_id, "sponsor_id");
  const attendee = await attendeeForActor(eventId, actor.id);

  const rows = await sql`
    update public.sponsor_interest
    set consented = true,
        undone_at = null,
        updated_at = now()
    where event_id = ${eventId}
      and attendee_id = ${attendee.id}
      and sponsor_id = ${sponsorId}
    returning *
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Sponsor interest not found" });
  }

  return c.json({ interest: rows[0], score: attendee.competition_score });
}

export async function undoSponsorInterest(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    sponsor_id?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const sponsorId = requiredString(body.sponsor_id, "sponsor_id");
  const attendee = await attendeeForActor(eventId, actor.id);

  const rows = await sql`
    update public.sponsor_interest
    set undone_at = now(),
        updated_at = now()
    where event_id = ${eventId}
      and attendee_id = ${attendee.id}
      and sponsor_id = ${sponsorId}
    returning *
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Sponsor interest not found" });
  }

  return c.json({ interest: rows[0], score: attendee.competition_score });
}

export async function listAnnouncements(c: Context) {
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const announcements = await sql`
    select id, title, body, posted_at
    from public.announcements
    where event_id = ${eventId}
    order by posted_at desc
    limit 10
  `;

  return c.json({ announcements });
}

export async function createAnnouncement(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    title?: unknown;
    body?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const title = requiredString(body.title, "title");
  const announcementBody = requiredString(body.body, "body");

  const rows = await sql`
    insert into public.announcements (event_id, title, body, posted_by_user_id)
    values (${eventId}, ${title}, ${announcementBody}, ${actor.id})
    returning id, title, body, posted_at
  `;

  return c.json({ announcement: rows[0] });
}
