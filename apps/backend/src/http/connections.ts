import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import { sql } from "../db/client";

// 1 pt to each attendee per new connection — keeps networking incentive
// without dominating sponsor QR scoring (which gives 5 pt per QR).
const CONNECTION_POINTS_SCANNER = 1;
const CONNECTION_POINTS_SCANNED = 1;

async function ensureTable() {
  await sql`
    create table if not exists public.attendee_connections (
      id          uuid        primary key default gen_random_uuid(),
      event_id    uuid        not null references public.events(id),
      scanner_id  uuid        not null references public.attendees(id),
      scanned_id  uuid        not null references public.attendees(id),
      created_at  timestamptz not null default now(),
      constraint attendee_connections_pair_unique unique (scanner_id, scanned_id)
    )
  `;
  await sql`
    create index if not exists attendee_connections_scanner_idx on public.attendee_connections(scanner_id)
  `;
  await sql`
    create index if not exists attendee_connections_scanned_idx on public.attendee_connections(scanned_id)
  `;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }
  return value.trim();
}

/* ── POST /attendees/connect ─────────────────────────────────────────────── */
export async function recordConnection(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventId       = requiredString(body.event_id,          "event_id");
  const targetAttendeeId = requiredString(body.target_attendee_id, "target_attendee_id");

  await ensureTable();

  // Resolve scanner's attendee row
  const scannerRows = await sql<Array<{ id: string }>>`
    select id from public.attendees
    where event_id = ${eventId} and auth_user_id = ${actor.id}
    limit 1
  `;
  const scanner = scannerRows[0];
  if (!scanner) throw new HTTPException(404, { message: "You are not registered for this event." });

  if (scanner.id === targetAttendeeId) {
    throw new HTTPException(400, { message: "You cannot connect with yourself." });
  }

  // Verify target attendee exists in same event
  const targetRows = await sql<Array<{ id: string; alias: string }>>`
    select id, alias from public.attendees
    where id = ${targetAttendeeId} and event_id = ${eventId}
    limit 1
  `;
  const target = targetRows[0];
  if (!target) throw new HTTPException(404, { message: "Attendee not found for this event." });

  // Record connection — idempotent
  const insertResult = await sql<Array<{ id: string }>>`
    insert into public.attendee_connections (event_id, scanner_id, scanned_id)
    values (${eventId}, ${scanner.id}, ${targetAttendeeId})
    on conflict (scanner_id, scanned_id) do nothing
    returning id
  `;

  const isNew = insertResult.length > 0;

  if (isNew) {
    // Award points to scanner (competition + spendable)
    await sql`
      update public.attendees
      set competition_score  = competition_score  + ${CONNECTION_POINTS_SCANNER},
          spendable_balance  = spendable_balance  + ${CONNECTION_POINTS_SCANNER},
          reached_current_score_at = case
            when competition_score = 0 then now()
            else reached_current_score_at
          end,
          updated_at = now()
      where id = ${scanner.id}
    `;

    // Award points to scanned attendee (smaller reward for being found)
    await sql`
      update public.attendees
      set competition_score  = competition_score  + ${CONNECTION_POINTS_SCANNED},
          spendable_balance  = spendable_balance  + ${CONNECTION_POINTS_SCANNED},
          updated_at = now()
      where id = ${targetAttendeeId}
    `;
  }

  // Return updated score for scanner
  const updatedRows = await sql<Array<{ competition_score: number }>>`
    select competition_score from public.attendees where id = ${scanner.id}
  `;

  return c.json({
    ok: true,
    already_connected: !isNew,
    points_awarded: isNew ? CONNECTION_POINTS_SCANNER : 0,
    new_score: updatedRows[0]?.competition_score ?? 0,
    connected_with: target.alias,
  });
}

/* ── GET /attendees/connections ──────────────────────────────────────────── */
export async function getMyConnections(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.query("event_id");
  if (!eventId) throw new HTTPException(400, { message: "event_id is required" });

  await ensureTable();

  const attendeeRows = await sql<Array<{ id: string }>>`
    select id from public.attendees
    where event_id = ${eventId} and auth_user_id = ${actor.id}
    limit 1
  `;
  const attendee = attendeeRows[0];
  if (!attendee) return c.json({ connections: [], total: 0 });

  // All connections both as scanner and as scanned (unique people)
  const connections = await sql<Array<{
    alias: string;
    real_name: string | null;
    business_name: string | null;
    connected_at: string;
    i_scanned: boolean;
  }>>`
    select distinct on (other_attendee.id)
      other_attendee.alias,
      other_attendee.real_name,
      other_attendee.business_name,
      ac.created_at as connected_at,
      (ac.scanner_id = ${attendee.id}) as i_scanned
    from public.attendee_connections ac
    join public.attendees other_attendee
      on other_attendee.id = case
        when ac.scanner_id = ${attendee.id} then ac.scanned_id
        else ac.scanner_id
      end
    where (ac.scanner_id = ${attendee.id} or ac.scanned_id = ${attendee.id})
      and ac.event_id = ${eventId}
    order by other_attendee.id, ac.created_at asc
  `;

  return c.json({ connections, total: connections.length });
}

/* ── GET /leaderboard/connections ────────────────────────────────────────── */
export async function getConnectionLeaderboard(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.query("event_id");
  if (!eventId) throw new HTTPException(400, { message: "event_id is required" });

  await ensureTable();

  const top = await sql<Array<{
    rank: number;
    alias: string;
    connection_count: number;
  }>>`
    select
      row_number() over (
        order by connection_count desc, earliest_connection asc nulls last, a.id asc
      )::int as rank,
      a.alias,
      coalesce(conn.connection_count, 0)::int as connection_count
    from public.attendees a
    left join (
      select
        unnested.attendee_id,
        count(distinct unnested.other_id) as connection_count,
        min(unnested.created_at) as earliest_connection
      from (
        select scanner_id as attendee_id, scanned_id as other_id, created_at
        from public.attendee_connections where event_id = ${eventId}
        union all
        select scanned_id as attendee_id, scanner_id as other_id, created_at
        from public.attendee_connections where event_id = ${eventId}
      ) unnested
      group by unnested.attendee_id
    ) conn on conn.attendee_id = a.id
    where a.event_id = ${eventId}
    order by connection_count desc, earliest_connection asc nulls last, a.id asc
    limit 10
  `;

  // Own rank
  const myAttendeeRows = await sql<Array<{ id: string; alias: string }>>`
    select id, alias from public.attendees
    where event_id = ${eventId} and auth_user_id = ${actor.id}
    limit 1
  `;
  const me = myAttendeeRows[0];

  let own: { rank: number; alias: string; connection_count: number } | null = null;

  if (me) {
    const ownRows = await sql<Array<{ rank: number; alias: string; connection_count: number }>>`
      select
        (
          select count(*)::int + 1
          from (
            select unnested.attendee_id, count(distinct unnested.other_id) as cnt
            from (
              select scanner_id as attendee_id, scanned_id as other_id
              from public.attendee_connections where event_id = ${eventId}
              union all
              select scanned_id as attendee_id, scanner_id as other_id
              from public.attendee_connections where event_id = ${eventId}
            ) unnested
            group by unnested.attendee_id
          ) others
          where cnt > coalesce((
            select count(distinct other_id)
            from (
              select scanned_id as other_id from public.attendee_connections
              where scanner_id = ${me.id}
              union
              select scanner_id as other_id from public.attendee_connections
              where scanned_id = ${me.id}
            ) mine
          ), 0)
        ) as rank,
        ${me.alias} as alias,
        coalesce((
          select count(distinct other_id)::int
          from (
            select scanned_id as other_id from public.attendee_connections
            where scanner_id = ${me.id} and event_id = ${eventId}
            union
            select scanner_id as other_id from public.attendee_connections
            where scanned_id = ${me.id} and event_id = ${eventId}
          ) mine
        ), 0) as connection_count
    `;
    own = ownRows[0] ?? null;
  }

  return c.json({ top, own });
}

/* ── POST /admin/connections/send-emails ─────────────────────────────────── */
export async function sendConnectionEmails(c: Context) {
  await ensureTable();

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventId = typeof body.event_id === "string" ? body.event_id.trim() : null;
  if (!eventId) throw new HTTPException(400, { message: "event_id is required" });

  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new HTTPException(500, { message: "Email not configured (RESEND_API_KEY / EMAIL_FROM missing)" });

  // Get event name
  const eventRows = await sql<Array<{ name: string }>>`
    select name from public.events where id = ${eventId} limit 1
  `;
  const eventName = eventRows[0]?.name ?? "SalesGeek Scotland Event";

  // Get all attendees with at least one connection
  const attendees = await sql<Array<{
    id: string;
    email: string;
    alias: string;
    real_name: string | null;
  }>>`
    select distinct a.id, a.email, a.alias, a.real_name
    from public.attendees a
    inner join public.attendee_connections ac
      on ac.scanner_id = a.id or ac.scanned_id = a.id
    where a.event_id = ${eventId}
      and a.email is not null
  `;

  let sent = 0;
  let failed = 0;

  for (const attendee of attendees) {
    // Get their specific connections
    const connections = await sql<Array<{ alias: string; real_name: string | null; business_name: string | null }>>`
      select distinct other_attendee.alias, other_attendee.real_name, other_attendee.business_name
      from public.attendee_connections ac
      join public.attendees other_attendee
        on other_attendee.id = case
          when ac.scanner_id = ${attendee.id} then ac.scanned_id
          else ac.scanner_id
        end
      where (ac.scanner_id = ${attendee.id} or ac.scanned_id = ${attendee.id})
        and ac.event_id = ${eventId}
    `;

    if (connections.length === 0) continue;

    const connectionRows = connections
      .map((c) => {
        const name = c.real_name ?? c.alias;
        const biz  = c.business_name ? ` · ${c.business_name}` : "";
        return `<tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;">${name}</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#666;">${biz}</td></tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#17191d;padding:28px 32px;">
          <p style="color:#FFD000;font-size:10px;font-weight:800;letter-spacing:0.12em;margin:0;">SALESGEEK SCOTLAND</p>
          <h1 style="color:white;font-size:22px;font-weight:900;margin:8px 0 0;letter-spacing:-0.01em;">${eventName}</h1>
          <p style="color:#9294a8;font-size:13px;margin:6px 0 0;">Your connections summary</p>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Hi ${attendee.real_name ?? attendee.alias},<br><br>
            Thank you for attending <strong>${eventName}</strong>! Here are the <strong>${connections.length} connection${connections.length !== 1 ? "s" : ""}</strong> you made on the day.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-top:20px;background:#f9fafb;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#6b7280;">NAME</th>
                <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#6b7280;">COMPANY</th>
              </tr>
            </thead>
            <tbody>${connectionRows}</tbody>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;line-height:1.6;">
            Reach out and keep the conversation going. That's what growth is about.
          </p>
        </div>
        <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="color:#d1d5db;font-size:11px;margin:0;">SalesGeek Scotland · ${eventName}</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: attendee.email,
          subject: `Your connections from ${eventName}`,
          html,
        }),
      });
      if (res.ok) { sent++; } else { failed++; }
    } catch {
      failed++;
    }
  }

  return c.json({ ok: true, sent, failed, total_attendees: attendees.length });
}
