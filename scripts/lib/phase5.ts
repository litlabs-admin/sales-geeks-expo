import Redis from "ioredis";
import { SignJWT } from "jose";
import { createQrCode, qrPurposeFingerprint, signQr, type QrType } from "@sgexpo/domain/qr";
import { backendBaseUrl, jwtSecret, sql } from "./phase2";
import { qrSigningSecret } from "./phase4";

let redisClient: Redis | null = null;

function getRedis() {
  redisClient ??= new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2
  });

  return redisClient;
}

export const redis = new Proxy({} as Redis, {
  get(_target, property) {
    const client = getRedis();
    const value = client[property as keyof Redis];
    return typeof value === "function" ? value.bind(client) : value;
  }
});

export type TestAttendee = {
  id: string;
  auth_user_id: string;
  alias: string;
};

export type TestQr = {
  id: string;
  event_id: string;
  code: string;
  signature: string;
  type: QrType;
  points: number;
};

export async function attendeeToken(attendee: TestAttendee) {
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

  return new SignJWT({ app_role: "attendee", email: `${attendee.alias}@example.test` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(attendee.auth_user_id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(jwtSecret));
}

export async function firstAttendee(eventId: string) {
  const rows = await sql<TestAttendee[]>`
    select id, auth_user_id, alias
    from public.attendees
    where event_id = ${eventId}
    order by created_at asc
    limit 1
  `;

  if (!rows[0]) {
    throw new Error("Seed attendees before running Phase 5 tests");
  }

  return rows[0];
}

export async function activeQr(eventId: string, type?: QrType) {
  const rows = type
    ? await sql<TestQr[]>`
        select id, event_id, code, signature, type, points
        from public.qr_codes
        where event_id = ${eventId}
          and type = ${type}
          and active = true
          and points > 0
          and (reveal_at is null or reveal_at <= now())
          and (expires_at is null or expires_at > now())
        order by created_at asc
        limit 1
      `
    : await sql<TestQr[]>`
        select id, event_id, code, signature, type, points
        from public.qr_codes
        where event_id = ${eventId}
          and active = true
          and points > 0
          and (reveal_at is null or reveal_at <= now())
          and (expires_at is null or expires_at > now())
        order by created_at asc
        limit 1
      `;

  if (!rows[0]) {
    throw new Error("Seed QRs before running Phase 5 tests");
  }

  return rows[0];
}

export async function resetAttendeeForQr(attendeeId: string, qrCodeId?: string) {
  if (qrCodeId) {
    const replayRows = await sql<Array<{ auth_user_id: string; event_id: string; code: string; signature: string }>>`
      select a.auth_user_id, q.event_id, q.code, q.signature
      from public.attendees a
      join public.qr_codes q on q.id = ${qrCodeId}
      where a.id = ${attendeeId}
      limit 1
    `;
    await sql`
      delete from public.scan_records
      where attendee_id = ${attendeeId}
        and qr_code_id = ${qrCodeId}
    `;
    await redis.del(`scan:${attendeeId}:${qrCodeId}`);
    const replay = replayRows[0];
    if (replay) {
      await redis.del(
        `scan-replay:${replay.auth_user_id}:${replay.event_id}:${replay.code}:${replay.signature}`,
        `leaderboard:${replay.event_id}`,
        `leaderboard-response:${replay.event_id}:${replay.auth_user_id}`
      );
    }
  } else {
    await sql`delete from public.scan_records where attendee_id = ${attendeeId}`;
  }

  await sql`
    update public.attendees
    set competition_score = 0,
        spendable_balance = 0,
        reached_current_score_at = null,
        updated_at = now()
    where id = ${attendeeId}
  `;
  await redis.del(`scan-rate:${attendeeId}`);
}

export async function postScan(input: {
  token: string;
  qr: TestQr;
  bypassRedis?: boolean;
  bypassRateLimit?: boolean;
}) {
  return fetch(`${backendBaseUrl}/scan/${input.qr.code}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event_id: input.qr.event_id,
      sig: input.qr.signature,
      bypass_redis: input.bypassRedis === true,
      bypass_rate_limit: input.bypassRateLimit === true
    })
  });
}

export async function insertQr(input: {
  eventId: string;
  type: QrType;
  reason: string;
  points: number;
  revealAt?: string | null;
  expiresAt?: string | null;
  zoneHint?: string | null;
  active?: boolean;
}) {
  const code = createQrCode(input.type.replace("_", "-"));
  const signature = signQr(
    {
      eventId: input.eventId,
      code,
      type: input.type
    },
    qrSigningSecret
  );
  const fingerprint = qrPurposeFingerprint({
    ownerType: "misc",
    ownerId: null,
    type: input.type,
    reason: input.reason
  });

  const rows = await sql<TestQr[]>`
    insert into public.qr_codes (
      event_id,
      owner_type,
      owner_id,
      type,
      code,
      signature,
      points,
      reveal_at,
      expires_at,
      zone_hint,
      reason,
      purpose_fingerprint,
      active
    )
    values (
      ${input.eventId},
      'misc',
      null,
      ${input.type},
      ${code},
      ${signature},
      ${input.points},
      ${input.revealAt ?? null},
      ${input.expiresAt ?? null},
      ${input.zoneHint ?? null},
      ${input.reason},
      ${fingerprint},
      ${input.active ?? true}
    )
    on conflict do nothing
    returning id, event_id, code, signature, type, points
  `;

  if (rows[0]) return rows[0];

  const existing = await sql<TestQr[]>`
    select id, event_id, code, signature, type, points
    from public.qr_codes
    where event_id = ${input.eventId}
      and owner_type = 'misc'
      and purpose_fingerprint = ${fingerprint}
    limit 1
  `;

  if (!existing[0]) throw new Error(`Failed to insert QR ${input.reason}`);

  await sql`
    update public.qr_codes
    set points = ${input.points},
        reveal_at = ${input.revealAt ?? null},
        expires_at = ${input.expiresAt ?? null},
        zone_hint = ${input.zoneHint ?? null},
        active = ${input.active ?? true},
        updated_at = now()
    where id = ${existing[0].id}
  `;

  return existing[0];
}

export async function closePhase5() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
