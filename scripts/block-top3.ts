/**
 * Print the top 3 attendees for each time block (Morning, Midday, Afternoon).
 *
 * Rebuilds the leaderboard *as of each block's end* by summing the points
 * that were actually awarded before that moment:
 *   - scan_records.points_competition  (sponsor QR scans, etc.)
 *   - attendee_connections             (1 pt each side per new connection)
 *
 * For an active block, "as of" = now. Tie-breaker: earliest-first action
 * timestamp, then attendee id.
 *
 * Usage:
 *   pnpm tsx scripts/block-top3.ts
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId("sge-2026");

type BlockDef = { key: string; label: string; startHour: number; endHour: number };

const BLOCKS: BlockDef[] = [
  { key: "block_1", label: "Morning Block",   startHour:  9, endHour: 11 },
  { key: "block_2", label: "Midday Block",    startHour: 11, endHour: 13 },
  { key: "block_3", label: "Afternoon Block", startHour: 13, endHour: 15 },
];

// Block windows are anchored to the event's local-day in Europe/London.
const windowRows = await sql<Array<{
  block_1_start: Date; block_1_end: Date;
  block_2_start: Date; block_2_end: Date;
  block_3_start: Date; block_3_end: Date;
  now_utc: Date;
}>>`
  with day_anchor as (
    select
      (date_trunc('day', e.starts_at at time zone 'Europe/London')
        at time zone 'Europe/London') as day_start
    from public.events e
    where e.id = ${eventId}
  )
  select
    day_start + interval '1 hour' * ${BLOCKS[0].startHour}::int as block_1_start,
    day_start + interval '1 hour' * ${BLOCKS[0].endHour}::int   as block_1_end,
    day_start + interval '1 hour' * ${BLOCKS[1].startHour}::int as block_2_start,
    day_start + interval '1 hour' * ${BLOCKS[1].endHour}::int   as block_2_end,
    day_start + interval '1 hour' * ${BLOCKS[2].startHour}::int as block_3_start,
    day_start + interval '1 hour' * ${BLOCKS[2].endHour}::int   as block_3_end,
    now() as now_utc
  from day_anchor
`;
const w = windowRows[0];
if (!w) throw new Error("Could not compute block windows");

const now = w.now_utc;
const windows = [
  { key: "block_1", label: BLOCKS[0].label, starts: w.block_1_start, ends: w.block_1_end },
  { key: "block_2", label: BLOCKS[1].label, starts: w.block_2_start, ends: w.block_2_end },
  { key: "block_3", label: BLOCKS[2].label, starts: w.block_3_start, ends: w.block_3_end },
];

function fmtHM(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).format(d);
}

function statusFor(starts: Date, ends: Date): "pending" | "active" | "ended" {
  if (now < starts) return "pending";
  if (now < ends) return "active";
  return "ended";
}

type Row = {
  alias: string;
  real_name: string | null;
  business_name: string | null;
  total: number;
  first_action: Date | null;
  attendee_id: string;
};

async function topNAt(asOf: Date, limit: number): Promise<Row[]> {
  // Sum scan-record points + connection points per attendee, only counting
  // rows with created_at <= asOf. Attendees are filtered to the event so
  // dev/test rows that were already cleaned up don't leak in.
  const rows = await sql<Array<{
    attendee_id: string;
    alias: string;
    real_name: string | null;
    business_name: string | null;
    scan_pts: number;
    conn_pts: number;
    first_action: Date | null;
  }>>`
    with scans as (
      select s.attendee_id,
             coalesce(sum(s.points_competition), 0)::int as scan_pts,
             min(s.awarded_at) as first_scan_at
      from public.scan_records s
      where s.event_id = ${eventId}
        and s.awarded_at <= ${asOf}
      group by s.attendee_id
    ),
    conns_a as (
      select scanner_id as attendee_id, count(*)::int as cnt, min(created_at) as first_at
      from public.attendee_connections
      where event_id = ${eventId}
        and created_at <= ${asOf}
      group by scanner_id
    ),
    conns_b as (
      select scanned_id as attendee_id, count(*)::int as cnt, min(created_at) as first_at
      from public.attendee_connections
      where event_id = ${eventId}
        and created_at <= ${asOf}
      group by scanned_id
    ),
    combined as (
      select a.id as attendee_id, a.alias, a.real_name, a.business_name,
             coalesce(scans.scan_pts, 0) as scan_pts,
             coalesce(ca.cnt, 0) + coalesce(cb.cnt, 0) as conn_pts,
             least(
               coalesce(scans.first_scan_at, 'infinity'::timestamptz),
               coalesce(ca.first_at, 'infinity'::timestamptz),
               coalesce(cb.first_at, 'infinity'::timestamptz)
             ) as first_action
      from public.attendees a
      left join scans   on scans.attendee_id = a.id
      left join conns_a ca on ca.attendee_id = a.id
      left join conns_b cb on cb.attendee_id = a.id
      where a.event_id = ${eventId}
    )
    select attendee_id, alias, real_name, business_name, scan_pts, conn_pts, first_action
    from combined
    where (scan_pts + conn_pts) > 0
    order by (scan_pts + conn_pts) desc,
             first_action asc nulls last,
             attendee_id asc
    limit ${limit}
  `;

  return rows.map((r) => ({
    alias: r.alias,
    real_name: r.real_name,
    business_name: r.business_name,
    total: (r.scan_pts ?? 0) + (r.conn_pts ?? 0),
    first_action: r.first_action,
    attendee_id: r.attendee_id,
  }));
}

console.log(`Event sge-2026 → ${eventId}`);
console.log(`Server now (BST): ${fmtHM(now)}\n`);

for (const blk of windows) {
  const status = statusFor(blk.starts, blk.ends);
  const asOf = status === "ended" ? blk.ends : now;
  const label = `${blk.label} (${fmtHM(blk.starts)}–${fmtHM(blk.ends)})`;
  const tag =
    status === "ended"  ? "🏁 ended — top 3 as of block end"
    : status === "active" ? "🔴 LIVE — top 3 right now"
                          : "⏳ not started yet";

  console.log("─".repeat(72));
  console.log(`${label}   ${tag}`);
  console.log("─".repeat(72));

  if (status === "pending") {
    console.log("   (no data yet)\n");
    continue;
  }

  const top = await topNAt(asOf, 3);
  if (top.length === 0) {
    console.log("   (no scores recorded in this block window)\n");
    continue;
  }
  for (let i = 0; i < top.length; i += 1) {
    const r = top[i]!;
    const medal = ["🥇", "🥈", "🥉"][i] ?? "  ";
    const name = r.real_name ? `${r.real_name} (${r.alias})` : r.alias;
    const biz = r.business_name ? ` · ${r.business_name}` : "";
    console.log(`   ${medal}  ${String(r.total).padStart(4)} pts   ${name}${biz}`);
  }
  console.log("");
}

await closeSql();
