import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import {
  matchingSignedQrType,
  type QrType,
  verifyQrSignature
} from "@sgexpo/domain/qr";
import type { Actor } from "@sgexpo/domain/rbac";
import type { ScanAwardResult } from "@sgexpo/domain/scoring";
import { sql } from "../db/client";
import { env } from "../env";
import { createRedisClient } from "../redis";

const redis = createRedisClient();
const hotCacheTtlMs = 30_000;
const qrCache = new Map<string, { value: QrRow; expiresAt: number }>();
const attendeeCache = new Map<string, { value: AttendeeRow; expiresAt: number }>();

type QrRow = {
  id: string;
  event_id: string;
  type: QrType;
  code: string;
  signature: string;
  points: number;
  reveal_at: string | null;
  expires_at: string | null;
  zone_hint: string | null;
  active: boolean;
};

type AttendeeRow = {
  id: string;
  event_id: string;
  auth_user_id: string;
  competition_score: number;
  spendable_balance: number;
  reached_current_score_at: string | null;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }

  return value.trim();
}

function statusCode(status: ScanAwardResult["status"]) {
  if (status === "awarded" || status === "already_collected") return 200;
  if (status === "not_yet_active") return 409;
  if (status === "inactive" || status === "expired") return 410;
  return 400;
}

function availabilityResult(qr: QrRow, window: { is_revealed: boolean; is_expired: boolean }) {
  if (!qr.active) {
    return {
      status: "inactive",
      points: 0,
      newScore: null,
      zoneHint: qr.zone_hint
    } satisfies ScanAwardResult;
  }

  if (!window.is_revealed) {
    return {
      status: "not_yet_active",
      points: 0,
      newScore: null,
      zoneHint: qr.zone_hint
    } satisfies ScanAwardResult;
  }

  if (window.is_expired) {
    return {
      status: "expired",
      points: 0,
      newScore: null,
      zoneHint: qr.zone_hint
    } satisfies ScanAwardResult;
  }

  return null;
}

async function ensureRedis() {
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }
}

async function checkRateLimit(attendeeId: string) {
  await ensureRedis();

  const key = `scan-rate:${attendeeId}`;
  const now = Date.now();
  const windowStart = now - 60_000;

  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);

  if (count >= 10) {
    throw new HTTPException(429, { message: "Too many scans. Please pause for a minute." });
  }

  await redis.zadd(key, now, `${now}:${Math.random()}`);
  await redis.expire(key, 70);
}

async function cacheDelete(key: string) {
  try {
    await ensureRedis();
    await redis.del(key);
  } catch {
    // Redis cache invalidation should not block award persistence.
  }
}

async function cacheSet(key: string, value: string, seconds: number) {
  try {
    await ensureRedis();
    await redis.set(key, value, "EX", seconds);
  } catch {
    // Redis is an optimization only.
  }
}

async function markScanInFlight(attendeeId: string, qrCodeId: string) {
  await ensureRedis();
  return redis.set(`scan:${attendeeId}:${qrCodeId}`, "1", "EX", 86_400, "NX");
}

async function isKnownReplay(key: string) {
  try {
    await ensureRedis();
    return (await redis.get(key)) === "1";
  } catch {
    return false;
  }
}

export async function findSignedQr(input: {
  eventId: string;
  code: string;
  signature: string;
  type?: QrType | null;
}) {
  const cacheKey = `${input.eventId}:${input.code}:${input.signature}:${input.type ?? ""}`;
  const cached = qrCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const type =
    input.type ??
    matchingSignedQrType({
      eventId: input.eventId,
      code: input.code,
      signature: input.signature,
      secret: env.QR_SIGNING_SECRET
    });

  if (!type) {
    throw new HTTPException(400, { message: "Invalid QR signature" });
  }

  if (
    !verifyQrSignature(
      {
        eventId: input.eventId,
        code: input.code,
        type,
        signature: input.signature
      },
      env.QR_SIGNING_SECRET
    )
  ) {
    throw new HTTPException(400, { message: "Invalid QR signature" });
  }

  const rows = await sql<QrRow[]>`
    select id, event_id, type, code, signature, points, reveal_at, expires_at, zone_hint, active
    from public.qr_codes
    where event_id = ${input.eventId}
      and code = ${input.code}
      and type = ${type}
      and signature = ${input.signature}
    limit 1
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "QR not found" });
  }

  qrCache.set(cacheKey, { value: rows[0], expiresAt: Date.now() + hotCacheTtlMs });
  return rows[0];
}

async function attendeeForActor(eventId: string, actor: Actor) {
  const cacheKey = `${eventId}:${actor.id}`;
  const cached = attendeeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const rows = await sql<AttendeeRow[]>`
    select id, event_id, auth_user_id, competition_score, spendable_balance, reached_current_score_at
    from public.attendees
    where event_id = ${eventId}
      and auth_user_id = ${actor.id}
    limit 1
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Attendee not found" });
  }

  attendeeCache.set(cacheKey, { value: rows[0], expiresAt: Date.now() + hotCacheTtlMs });
  return rows[0];
}

export async function awardScan(input: {
  actor: Actor;
  attendeeId: string;
  eventId: string;
  qrCodeId: string;
  useRedisIdempotency?: boolean;
  useRateLimit?: boolean;
}): Promise<ScanAwardResult> {
  const preflight = await sql<QrRow[]>`
    select id, event_id, type, code, signature, points, reveal_at, expires_at, zone_hint, active
    from public.qr_codes
    where id = ${input.qrCodeId}
      and event_id = ${input.eventId}
    limit 1
  `;
  const preflightQr = preflight[0];

  if (!preflightQr) {
    throw new HTTPException(404, { message: "QR not found" });
  }

  const preflightWindow = await sql<{ is_revealed: boolean; is_expired: boolean }[]>`
    select
      (${preflightQr.reveal_at}::timestamptz is null or now() >= ${preflightQr.reveal_at}::timestamptz) as is_revealed,
      (${preflightQr.expires_at}::timestamptz is not null and now() > ${preflightQr.expires_at}::timestamptz) as is_expired
  `;
  const preflightAvailability = availabilityResult(preflightQr, preflightWindow[0] ?? {
    is_revealed: true,
    is_expired: false
  });

  if (preflightAvailability) {
    return preflightAvailability;
  }

  if (input.useRedisIdempotency !== false) {
    const claimed = await markScanInFlight(input.attendeeId, input.qrCodeId);
    if (claimed !== "OK") {
      return {
        status: "already_collected",
        points: 0,
        newScore: null
      };
    }
  }

  if (input.useRateLimit !== false) {
    await checkRateLimit(input.attendeeId);
  }

  let result: ScanAwardResult | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await sql.begin(async (tx) => {
    const qrRows = await tx<QrRow[]>`
      select id, event_id, type, code, signature, points, reveal_at, expires_at, zone_hint, active
      from public.qr_codes
      where id = ${input.qrCodeId}
        and event_id = ${input.eventId}
      limit 1
    `;
    const qr = qrRows[0];

    if (!qr) {
      throw new HTTPException(404, { message: "QR not found" });
    }

    const nowRows = await tx<{ is_revealed: boolean; is_expired: boolean }[]>`
      select
        (${qr.reveal_at}::timestamptz is null or now() >= ${qr.reveal_at}::timestamptz) as is_revealed,
        (${qr.expires_at}::timestamptz is not null and now() > ${qr.expires_at}::timestamptz) as is_expired
    `;
    const availability = availabilityResult(qr, nowRows[0] ?? {
      is_revealed: true,
      is_expired: false
    });

    if (availability) {
      return availability;
    }

    const inserted = await tx<{ id: string }[]>`
      insert into public.scan_records (
        event_id,
        attendee_id,
        qr_code_id,
        points_competition,
        points_spendable
      )
      values (${input.eventId}, ${input.attendeeId}, ${input.qrCodeId}, ${qr.points}, ${qr.points})
      on conflict (attendee_id, qr_code_id) do nothing
      returning id
    `;

    if (!inserted[0]) {
      const attendeeRows = await tx<{ competition_score: number }[]>`
        select competition_score
        from public.attendees
        where id = ${input.attendeeId}
        limit 1
      `;

      return {
        status: "already_collected",
        points: 0,
        newScore: attendeeRows[0]?.competition_score ?? null
      } satisfies ScanAwardResult;
    }

    const competitionRows = await tx<{ competition_score: number }[]>`
      update public.attendees
      set competition_score = competition_score + ${qr.points},
          reached_current_score_at = case
            when ${qr.points} > 0 then now()
            else reached_current_score_at
          end,
          updated_at = now()
      where id = ${input.attendeeId}
      returning competition_score
    `;

    const spendableRows = await tx<{ spendable_balance: number }[]>`
      update public.attendees
      set spendable_balance = spendable_balance + ${qr.points},
          updated_at = now()
      where id = ${input.attendeeId}
      returning spendable_balance
    `;

    await tx`
      insert into public.audit_logs (
        actor_user_id,
        actor_role,
        action,
        target_type,
        target_id,
        reason,
        metadata
      )
      values (
        ${input.actor.id},
        ${input.actor.role}::public.app_role,
        'scan.awarded',
        'qr_code',
        ${input.qrCodeId},
        'attendee_scan',
        ${JSON.stringify({
          attendee_id: input.attendeeId,
          points_competition: qr.points,
          points_spendable: qr.points,
          spendable_balance: spendableRows[0]?.spendable_balance ?? null
        })}::jsonb
      )
    `;

    return {
      status: "awarded",
      points: qr.points,
      newScore: competitionRows[0]?.competition_score ?? null
    } satisfies ScanAwardResult;
      });
      break;
    } catch (error) {
      if ((error as { code?: string }).code === "40001" && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  if (!result) {
    throw new HTTPException(500, { message: "Scan could not be awarded" });
  }

  if (result.status === "awarded") {
    await cacheDelete(`leaderboard:${input.eventId}`);
    await cacheDelete(`leaderboard-response:${input.eventId}:${input.actor.id}`);
  }

  return result;
}

export async function awardScanRoute(c: Context) {
  const actor = c.get("actor") as Actor;
  const code = requiredString(c.req.param("code"), "code");
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    sig?: unknown;
    type?: unknown;
    bypass_redis?: unknown;
    bypass_rate_limit?: unknown;
  };
  const eventId = requiredString(body.event_id ?? c.req.query("event_id"), "event_id");
  const signature = requiredString(body.sig ?? c.req.query("sig"), "sig");
  const replayKey = `scan-replay:${actor.id}:${eventId}:${code}:${signature}`;
  const signedType = matchingSignedQrType({
    eventId,
    code,
    signature,
    secret: env.QR_SIGNING_SECRET
  });

  if (signedType && (await isKnownReplay(replayKey))) {
    return c.json(
      {
        result: {
          status: "already_collected",
          points: 0,
          newScore: null
        }
      },
      200
    );
  }

  const qr = await findSignedQr({
    eventId,
    code,
    signature,
    type: typeof body.type === "string" ? (body.type as QrType) : null
  });
  const attendee = await attendeeForActor(eventId, actor);
  const result = await awardScan({
    actor,
    attendeeId: attendee.id,
    eventId,
    qrCodeId: qr.id,
    useRedisIdempotency: !(env.NODE_ENV !== "production" && body.bypass_redis === true),
    useRateLimit: !(env.NODE_ENV !== "production" && body.bypass_rate_limit === true)
  });

  if (result.status === "awarded" || result.status === "already_collected") {
    await cacheSet(replayKey, "1", 86_400);
  }

  return c.json({ result }, statusCode(result.status));
}

export async function replayPendingScans(input: {
  eventId: string;
  actor: Actor;
  attendeeId: string;
}) {
  const rows = await sql<{ id: string; qr_code_id: string }[]>`
    select id, qr_code_id
    from public.pending_scans
    where event_id = ${input.eventId}
      and auth_user_id = ${input.actor.id}
    order by created_at asc
  `;

  for (const row of rows) {
    await awardScan({
      actor: input.actor,
      attendeeId: input.attendeeId,
      eventId: input.eventId,
      qrCodeId: row.qr_code_id,
      useRateLimit: false
    }).catch(() => null);

    await sql`
      delete from public.pending_scans
      where id = ${row.id}
    `;
  }
}

export async function getLeaderboard(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const cacheKey = `leaderboard:${eventId}`;
  const responseCacheKey = `leaderboard-response:${eventId}:${actor.id}`;
  try {
    await ensureRedis();
    const cachedResponse = await redis.get(responseCacheKey);
    if (cachedResponse) {
      return c.json(JSON.parse(cachedResponse));
    }
  } catch {
    // Full-response cache is an optimization only.
  }

  let top: Array<{ rank: number; alias: string; competition_score: number }> | null = null;

  try {
    await ensureRedis();
    const cached = await redis.get(cacheKey);
    top = cached
      ? (JSON.parse(cached) as Array<{ rank: number; alias: string; competition_score: number }>)
      : null;
  } catch {
    top = null;
  }

  if (!top) {
    top = await sql<Array<{ rank: number; alias: string; competition_score: number }>>`
      select rank, alias, competition_score
      from (
        select
          row_number() over (
            order by competition_score desc, reached_current_score_at asc nulls last, id asc
          )::int as rank,
          alias,
          competition_score
        from public.attendees
        where event_id = ${eventId}
      ) ranked
      order by rank asc
      limit 10
    `;

    try {
      await ensureRedis();
      await redis.set(cacheKey, JSON.stringify(top), "EX", 30);
    } catch {
      // Leaderboard cache is an optimization only.
    }
  }

  const ownRows = await sql<
    Array<{
      rank: number;
      alias: string;
      competition_score: number;
    }>
  >`
    with own as (
      select id, alias, competition_score, reached_current_score_at
      from public.attendees
      where event_id = ${eventId}
        and auth_user_id = ${actor.id}
      limit 1
    )
    select
      (
        select count(*)::int + 1
        from public.attendees other, own
        where other.event_id = ${eventId}
          and (
            other.competition_score > own.competition_score
            or (
              other.competition_score = own.competition_score
              and other.reached_current_score_at < own.reached_current_score_at
            )
            or (
              other.competition_score = own.competition_score
              and other.reached_current_score_at is not distinct from own.reached_current_score_at
              and other.id < own.id
            )
          )
      ) as rank,
      own.alias,
      own.competition_score
    from own
  `;

  const payload = { top, own: ownRows[0] ?? null };

  try {
    await ensureRedis();
    await redis.set(responseCacheKey, JSON.stringify(payload), "EX", 5);
  } catch {
    // Full-response cache is an optimization only.
  }

  return c.json(payload);
}
