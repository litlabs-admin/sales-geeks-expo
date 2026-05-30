import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import { toCsv } from "@sgexpo/domain/exports";
import { sql } from "../db/client";

async function exportRows(type: string, eventId: string) {
  if (type === "attendees") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select id, email, real_name, business_name, alias, is_verified, checked_in_at, competition_score, spendable_balance
      from public.attendees
      where event_id = ${eventId}
      order by created_at asc
    `;
    return toCsv(rows, [
      "id",
      "email",
      "real_name",
      "business_name",
      "alias",
      "is_verified",
      "checked_in_at",
      "competition_score",
      "spendable_balance"
    ]);
  }

  if (type === "scans") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select sr.id, a.alias, q.code, q.type, sr.points_competition, sr.points_spendable, sr.awarded_at
      from public.scan_records sr
      join public.attendees a on a.id = sr.attendee_id
      join public.qr_codes q on q.id = sr.qr_code_id
      where sr.event_id = ${eventId}
      order by sr.awarded_at asc
    `;
    return toCsv(rows, ["id", "alias", "code", "type", "points_competition", "points_spendable", "awarded_at"]);
  }

  if (type === "sponsor-leads") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select si.id, s.name as sponsor_name, a.email, a.real_name, a.business_name, si.created_at
      from public.sponsor_interest si
      join public.sponsors s on s.id = si.sponsor_id
      join public.attendees a on a.id = si.attendee_id
      where si.event_id = ${eventId}
        and si.consented = true
        and si.undone_at is null
      order by si.created_at asc
    `;
    return toCsv(rows, ["id", "sponsor_name", "email", "real_name", "business_name", "created_at"]);
  }

  if (type === "leaderboard") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select
        row_number() over (
          order by competition_score desc, reached_current_score_at asc nulls last, id asc
        )::int as rank,
        alias,
        competition_score,
        reached_current_score_at
      from public.attendees
      where event_id = ${eventId}
      order by rank asc
    `;
    return toCsv(rows, ["rank", "alias", "competition_score", "reached_current_score_at"]);
  }

  if (type === "notifications") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select id, title, audience, scheduled_at, delivered_at, created_at
      from public.notifications
      where event_id = ${eventId}
      order by created_at asc
    `;
    return toCsv(rows, ["id", "title", "audience", "scheduled_at", "delivered_at", "created_at"]);
  }

  if (type === "audit-logs") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select id, actor_user_id, actor_role, action, target_type, target_id, reason, created_at
      from public.audit_logs
      where metadata->>'event_id' = ${eventId}
         or target_id = ${eventId}
      order by created_at asc
    `;
    return toCsv(rows, ["id", "actor_user_id", "actor_role", "action", "target_type", "target_id", "reason", "created_at"]);
  }

  if (type === "qr-analytics") {
    const rows = await sql<Array<Record<string, unknown>>>`
      select qr_code_id, campaign_name, type, status, active, total_scans, unique_attendees, last_scan_at
      from public.vw_ops_qr_activity
      where event_id = ${eventId}
      order by total_scans desc, campaign_name asc
    `;
    return toCsv(rows, ["qr_code_id", "campaign_name", "type", "status", "active", "total_scans", "unique_attendees", "last_scan_at"]);
  }

  throw new HTTPException(404, { message: "Unknown export type" });
}

export async function exportCsv(c: Context) {
  const actor = c.get("actor") as Actor;
  const type = c.req.param("type");
  const eventId = c.req.query("event_id");

  if (!type) {
    throw new HTTPException(400, { message: "type is required" });
  }

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const asOfRows = await sql<{ as_of: string }[]>`select now() as as_of`;
  const asOf = asOfRows[0]?.as_of ?? new Date().toISOString();
  const csv = await exportRows(type, eventId);

  await sql`
    insert into public.audit_logs (
      actor_user_id, actor_role, action, target_type, target_id, reason, metadata
    )
    values (
      ${actor.id},
      ${actor.role}::public.app_role,
      'export.generated',
      'export',
      ${type},
      'admin_export',
      ${JSON.stringify({ event_id: eventId, as_of: asOf })}::jsonb
    )
  `;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}-${eventId}.csv"`,
      "x-export-as-of": asOf
    }
  });
}
