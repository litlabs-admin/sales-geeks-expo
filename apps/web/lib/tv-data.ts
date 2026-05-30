import { createClient } from "@supabase/supabase-js";

/* TV portals run on big public screens with no login — every fetch uses
   service-role on the server. These helpers stay private to the server:
   never import from a client component.
   Lazy block-winner locking is replicated here so a portal can do the snapshot
   itself without an auth'd backend call. The unique (event_id, block_key)
   index keeps it race-safe against the Hono backend doing the same.
   Untyped client because db-types.ts only covers a subset of tables. */

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export type TvEvent = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
};

export async function getTvEvent(slug: string): Promise<TvEvent | null> {
  const { data } = await serviceSupabase()
    .from("events")
    .select("id,slug,name,starts_at")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  return (data as TvEvent | null) ?? null;
}

export type TvLeaderboardRow = { rank: number; alias: string; competition_score: number };

export async function getTvPointsLeaderboard(eventId: string, limit = 10): Promise<TvLeaderboardRow[]> {
  const { data } = await serviceSupabase()
    .from("attendees")
    .select("alias,competition_score,reached_current_score_at,id")
    .eq("event_id", eventId)
    .order("competition_score", { ascending: false })
    .order("reached_current_score_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(limit);
  return ((data ?? []) as Array<{ alias: string; competition_score: number }>).map((row, idx) => ({
    rank: idx + 1,
    alias: row.alias,
    competition_score: row.competition_score
  }));
}

export type TvConnectionRow = { rank: number; alias: string; connection_count: number };

export async function getTvConnectionLeaderboard(eventId: string, limit = 10): Promise<TvConnectionRow[]> {
  // Distinct-pair count in either direction. Aggregating in app code keeps
  // the SQL simple; volume is bounded (max ~500 attendees, low thousands of
  // connections at this event scale).
  const supabase = serviceSupabase();
  const [{ data: pairs }, { data: attendees }] = await Promise.all([
    supabase.from("attendee_connections").select("scanner_id,scanned_id").eq("event_id", eventId),
    supabase.from("attendees").select("id,alias").eq("event_id", eventId)
  ]);

  const counts = new Map<string, Set<string>>();
  for (const p of (pairs ?? []) as Array<{ scanner_id: string; scanned_id: string }>) {
    if (!counts.has(p.scanner_id)) counts.set(p.scanner_id, new Set());
    if (!counts.has(p.scanned_id)) counts.set(p.scanned_id, new Set());
    counts.get(p.scanner_id)!.add(p.scanned_id);
    counts.get(p.scanned_id)!.add(p.scanner_id);
  }

  return ((attendees ?? []) as Array<{ id: string; alias: string }>)
    .map((a) => ({ id: a.id, alias: a.alias, connection_count: counts.get(a.id)?.size ?? 0 }))
    .filter((row) => row.connection_count > 0)
    .sort((a, b) => b.connection_count - a.connection_count || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((row, idx) => ({ rank: idx + 1, alias: row.alias, connection_count: row.connection_count }));
}

export type TvStats = {
  total_attendees: number;
  checked_in: number;
  verified: number;
  total_scans: number;
  total_connections: number;
  connections_last_hour: number;
};

export async function getTvStats(eventId: string): Promise<TvStats> {
  const supabase = serviceSupabase();
  const [att, scans, connections] = await Promise.all([
    supabase.from("attendees").select("id,checked_in_at,is_verified").eq("event_id", eventId),
    supabase.from("scan_records").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("attendee_connections").select("id,created_at").eq("event_id", eventId)
  ]);

  const attRows = (att.data ?? []) as Array<{ id: string; checked_in_at: string | null; is_verified: boolean }>;
  const total = attRows.length;
  const checked = attRows.filter((r) => r.checked_in_at !== null).length;
  const verified = attRows.filter((r) => r.is_verified).length;

  const connRows = (connections.data ?? []) as Array<{ id: string; created_at: string }>;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const lastHour = connRows.filter((r) => new Date(r.created_at).getTime() >= oneHourAgo).length;

  return {
    total_attendees: total,
    checked_in: checked,
    verified,
    total_scans: scans.count ?? 0,
    total_connections: connRows.length,
    connections_last_hour: lastHour
  };
}

export type TvBlock = {
  key: string;
  label: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "active" | "ended";
  winner: { alias: string | null; competition_score: number } | null;
  live_leader: { alias: string; competition_score: number } | null;
};

const BLOCK_DEFS = [
  { key: "block_1", label: "Morning Block",   startHour:  9, endHour: 11 },
  { key: "block_2", label: "Midday Block",    startHour: 11, endHour: 13 },
  { key: "block_3", label: "Afternoon Block", startHour: 13, endHour: 15 }
];

function computeBlockTimes(eventStartsAt: string): { key: string; label: string; starts_at: Date; ends_at: Date }[] {
  // Anchor blocks to the event's local day in Europe/London. In late May
  // Glasgow is on BST (UTC+1), so we compute the calendar date in BST and
  // add the block hours back in UTC.
  const eventDate = new Date(eventStartsAt);
  const bstOffsetMs = 60 * 60 * 1000;
  const localDate = new Date(eventDate.getTime() + bstOffsetMs);
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();

  function blockTime(hour: number): Date {
    // Hour in BST → subtract BST offset for UTC instant
    return new Date(Date.UTC(year, month, day, hour - 1, 0, 0));
  }

  return BLOCK_DEFS.map((b) => ({
    key: b.key,
    label: b.label,
    starts_at: blockTime(b.startHour),
    ends_at: blockTime(b.endHour)
  }));
}

export async function getTvBlocks(eventId: string, eventStartsAt: string): Promise<TvBlock[]> {
  const supabase = serviceSupabase();
  const times = computeBlockTimes(eventStartsAt);
  const now = Date.now();

  const { data: locks } = await supabase
    .from("leaderboard_winners")
    .select("block_key,alias,competition_score")
    .eq("event_id", eventId);
  const lockByKey = new Map<string, { alias: string | null; competition_score: number }>();
  for (const l of (locks ?? []) as Array<{ block_key: string; alias: string | null; competition_score: number }>) {
    lockByKey.set(l.block_key, { alias: l.alias, competition_score: l.competition_score });
  }

  let liveLeader: { alias: string; competition_score: number } | null = null;
  const anyActive = times.some((t) => t.starts_at.getTime() <= now && now < t.ends_at.getTime());
  if (anyActive) {
    const { data } = await supabase
      .from("attendees")
      .select("alias,competition_score")
      .eq("event_id", eventId)
      .order("competition_score", { ascending: false })
      .order("reached_current_score_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(1);
    const row = (data?.[0] ?? null) as { alias: string; competition_score: number } | null;
    if (row) liveLeader = row;
  }

  const blocks: TvBlock[] = [];
  for (const t of times) {
    const startMs = t.starts_at.getTime();
    const endMs = t.ends_at.getTime();
    const status: TvBlock["status"] = now < startMs ? "pending" : now < endMs ? "active" : "ended";

    let winner: TvBlock["winner"] = null;
    if (status === "ended") {
      const existing = lockByKey.get(t.key);
      if (existing) {
        winner = existing;
      } else {
        // Lazy-lock: snapshot current #1. Race-safe via unique constraint.
        const { data: top } = await supabase
          .from("attendees")
          .select("id,alias,competition_score")
          .eq("event_id", eventId)
          .order("competition_score", { ascending: false })
          .order("reached_current_score_at", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(1);
        const topRow = (top?.[0] ?? null) as { id: string; alias: string; competition_score: number } | null;
        await supabase.from("leaderboard_winners").insert({
          event_id: eventId,
          block_key: t.key,
          block_starts_at: t.starts_at.toISOString(),
          block_ends_at: t.ends_at.toISOString(),
          attendee_id: topRow?.id ?? null,
          alias: topRow?.alias ?? null,
          competition_score: topRow?.competition_score ?? 0
        });
        winner = { alias: topRow?.alias ?? null, competition_score: topRow?.competition_score ?? 0 };
      }
    }

    blocks.push({
      key: t.key,
      label: t.label,
      starts_at: t.starts_at.toISOString(),
      ends_at: t.ends_at.toISOString(),
      status,
      winner,
      live_leader: status === "active" ? liveLeader : null
    });
  }

  return blocks;
}

export type TvBusiness = {
  id: string;
  name: string;
  sponsor_tier: string | null;
  logo_url: string | null;
  website_url: string | null;
};

export async function getTvBusinesses(eventId: string): Promise<TvBusiness[]> {
  const { data } = await serviceSupabase()
    .from("businesses")
    .select("id,name,sponsor_tier,logo_url,website_url")
    .eq("event_id", eventId)
    .is("archived_at", null)
    .order("sponsor_tier", { ascending: true })
    .order("name", { ascending: true });
  return ((data ?? []) as TvBusiness[]);
}
