import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { backendBaseUrl, jwtSecret, sql } from "./phase2";
import { attendeeToken, closePhase5, redis, type TestAttendee } from "./phase5";

export type RewardRow = {
  id: string;
  event_id: string;
  name: string;
  type: "standard" | "william_premium";
  cost: number;
  inventory: number;
  per_attendee_limit: number;
};

export async function rewardByName(eventId: string, namePattern: string) {
  const rows = await sql<RewardRow[]>`
    select id, event_id, name, type, cost, inventory, per_attendee_limit
    from public.rewards
    where event_id = ${eventId}
      and name ilike ${namePattern}
    order by name asc
    limit 1
  `;

  if (!rows[0]) throw new Error(`Reward not found: ${namePattern}`);
  return rows[0];
}

export async function attendees(eventId: string, limit = 1) {
  const rows = await sql<TestAttendee[]>`
    select id, auth_user_id, alias
    from public.attendees
    where event_id = ${eventId}
    order by created_at asc
    limit ${limit}
  `;

  if (rows.length < limit) throw new Error(`Expected ${limit} attendees, saw ${rows.length}`);
  return rows;
}

export async function setBalance(attendeeId: string, balance: number) {
  await sql`
    update public.attendees
    set spendable_balance = ${balance},
        updated_at = now()
    where id = ${attendeeId}
  `;
}

export async function clearRedemptions(eventId: string, attendeeIds?: string[]) {
  const ids = attendeeIds ?? [];

  if (ids.length > 0) {
    await sql`
      delete from public.redemption_holds
      where event_id = ${eventId}
        and attendee_id = any(${ids}::uuid[])
    `;
    await sql`
      delete from public.redemption_records
      where event_id = ${eventId}
        and attendee_id = any(${ids}::uuid[])
    `;
  } else {
    await sql`delete from public.redemption_holds where event_id = ${eventId}`;
    await sql`delete from public.redemption_records where event_id = ${eventId}`;
  }
}

export async function postRedeem(input: {
  attendee: TestAttendee;
  reward: RewardRow;
  requestId: string;
}) {
  const token = await attendeeToken(input.attendee);

  return fetch(`${backendBaseUrl}/rewards/redeem`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event_id: input.reward.event_id,
      reward_id: input.reward.id,
      request_id: input.requestId
    })
  });
}

export async function adminToken() {
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

  const rows = await sql<{ id: string; email: string | null }[]>`
    select id, email from public.users where role = 'admin' limit 1
  `;
  const user = rows[0];
  if (!user) throw new Error("Admin user is not seeded");

  return new SignJWT({ app_role: "admin", email: user.email ?? "admin@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(jwtSecret));
}

export async function staffToken() {
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET is required");

  const rows = await sql<{ id: string; email: string | null }[]>`
    select id, email from public.users where role = 'staff' limit 1
  `;
  const user = rows[0];
  if (!user) throw new Error("Staff user is not seeded");

  return new SignJWT({ app_role: "staff", email: user.email ?? "staff@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(jwtSecret));
}

export function calendlySignature(payload: string) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) throw new Error("CALENDLY_WEBHOOK_SECRET is required");

  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function postCalendly(eventSlug: string, payload: unknown) {
  const body = JSON.stringify(payload);

  return fetch(`${backendBaseUrl}/webhooks/calendly/${eventSlug}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sgexpo-signature": calendlySignature(body)
    },
    body
  });
}

export async function closePhase6() {
  await closePhase5();
}
