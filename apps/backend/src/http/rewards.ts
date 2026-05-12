import { createHmac, timingSafeEqual } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Actor } from "@sgexpo/domain/rbac";
import type { RedemptionResult } from "@sgexpo/domain/rewards";
import { sql } from "../db/client";
import { env } from "../env";
import { createRedisClient } from "../redis";

const redis = createRedisClient();

type RewardRow = {
  id: string;
  event_id: string;
  name: string;
  type: "standard" | "william_premium";
  cost: number;
  inventory: number;
  per_attendee_limit: number;
  expires_at: string | null;
};

type AttendeeRow = {
  id: string;
  auth_user_id: string;
  email: string | null;
  spendable_balance: number;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${field} is required` });
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function ensureRedis() {
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }
}

function statusCode(status: RedemptionResult["status"]) {
  if (status === "completed" || status === "pending_booking" || status === "already_processed") {
    return 200;
  }
  return 400;
}

async function attendeeForActor(eventId: string, actor: Actor) {
  const rows = await sql<AttendeeRow[]>`
    select id, auth_user_id, email, spendable_balance
    from public.attendees
    where event_id = ${eventId}
      and auth_user_id = ${actor.id}
    limit 1
  `;

  if (!rows[0]) {
    throw new HTTPException(404, { message: "Attendee not found" });
  }

  return rows[0];
}

async function withSerializable<T>(work: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string }).code === "40001" && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new HTTPException(500, { message: "Transaction retry exhausted" });
}

async function claimRedeemRequest(input: {
  attendeeId: string;
  rewardId: string;
  requestId: string;
}) {
  await ensureRedis();
  return redis.set(
    `redeem:${input.attendeeId}:${input.rewardId}:${input.requestId}`,
    "1",
    "EX",
    86_400,
    "NX"
  );
}

export async function listRewards(c: Context) {
  const eventId = c.req.query("event_id");

  if (!eventId) {
    throw new HTTPException(400, { message: "event_id is required" });
  }

  const rewards = await sql`
    select id, event_id, name, type, cost, inventory, per_attendee_limit, external_provider, redemption_policy
    from public.rewards
    where event_id = ${eventId}
      and (expires_at is null or expires_at > now())
    order by cost asc, name asc
  `;

  return c.json({ rewards });
}

export async function redeemReward(input: {
  actor: Actor;
  eventId: string;
  attendeeId: string;
  rewardId: string;
  requestId: string;
  staffId?: string | null;
}) {
  const claimed = await claimRedeemRequest({
    attendeeId: input.attendeeId,
    rewardId: input.rewardId,
    requestId: input.requestId
  });

  if (claimed !== "OK") {
    return { status: "already_processed" } satisfies RedemptionResult;
  }

  return withSerializable(() =>
    sql.begin("isolation level serializable", async (tx) => {
      const rewardRows = await tx<RewardRow[]>`
        select id, event_id, name, type, cost, inventory, per_attendee_limit, expires_at
        from public.rewards
        where id = ${input.rewardId}
          and event_id = ${input.eventId}
        for update
      `;
      const reward = rewardRows[0];

      if (!reward) {
        throw new HTTPException(404, { message: "Reward not found" });
      }

      if (reward.type !== "standard") {
        throw new HTTPException(400, { message: "Use the William claim flow for this reward" });
      }

      if (reward.inventory <= 0 || (reward.expires_at && new Date(reward.expires_at) <= new Date())) {
        return { status: "sold_out" } satisfies RedemptionResult;
      }

      const attendeeRows = await tx<AttendeeRow[]>`
        select id, auth_user_id, email, spendable_balance
        from public.attendees
        where id = ${input.attendeeId}
          and event_id = ${input.eventId}
        for update
      `;
      const attendee = attendeeRows[0];

      if (!attendee) {
        throw new HTTPException(404, { message: "Attendee not found" });
      }

      const countRows = await tx<{ count: number }[]>`
        select count(*)::int as count
        from public.redemption_records
        where event_id = ${input.eventId}
          and attendee_id = ${input.attendeeId}
          and reward_id = ${input.rewardId}
          and state <> 'reversed'
      `;

      if ((countRows[0]?.count ?? 0) >= reward.per_attendee_limit) {
        return { status: "limit_reached" } satisfies RedemptionResult;
      }

      if (attendee.spendable_balance < reward.cost) {
        return { status: "insufficient_balance" } satisfies RedemptionResult;
      }

      const updatedReward = await tx<{ inventory: number }[]>`
        update public.rewards
        set inventory = inventory - 1,
            updated_at = now()
        where id = ${reward.id}
          and inventory > 0
        returning inventory
      `;

      if (!updatedReward[0]) {
        return { status: "sold_out" } satisfies RedemptionResult;
      }

      const updatedAttendee = await tx<{ spendable_balance: number }[]>`
        update public.attendees
        set spendable_balance = spendable_balance - ${reward.cost},
            updated_at = now()
        where id = ${input.attendeeId}
          and spendable_balance >= ${reward.cost}
        returning spendable_balance
      `;

      if (!updatedAttendee[0]) {
        return { status: "insufficient_balance" } satisfies RedemptionResult;
      }

      const redemptionRows = await tx<{ id: string }[]>`
        insert into public.redemption_records (
          event_id,
          attendee_id,
          reward_id,
          state,
          staff_id,
          request_id,
          completed_at
        )
        values (
          ${input.eventId},
          ${input.attendeeId},
          ${input.rewardId},
          'completed',
          ${input.staffId ?? null},
          ${input.requestId},
          now()
        )
        returning id
      `;
      const redemption = redemptionRows[0];

      await tx`
        insert into public.audit_logs (
          actor_user_id, actor_role, action, target_type, target_id, reason, metadata
        )
        values (
          ${input.actor.id},
          ${input.actor.role}::public.app_role,
          'reward.redeemed',
          'reward',
          ${input.rewardId},
          'reward_redemption',
          ${JSON.stringify({
            attendee_id: input.attendeeId,
            cost: reward.cost,
            new_balance: updatedAttendee[0].spendable_balance
          })}::jsonb
        )
      `;

      return {
        status: "completed",
        redemptionId: redemption?.id ?? "",
        cost: reward.cost,
        newBalance: updatedAttendee[0].spendable_balance
      } satisfies RedemptionResult;
    })
  );
}

export async function redeemRewardRoute(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    reward_id?: unknown;
    request_id?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const rewardId = requiredString(body.reward_id, "reward_id");
  const requestId = requiredString(body.request_id ?? crypto.randomUUID(), "request_id");
  const attendee = await attendeeForActor(eventId, actor);
  const result = await redeemReward({
    actor,
    eventId,
    attendeeId: attendee.id,
    rewardId,
    requestId
  });

  return c.json({ result }, statusCode(result.status));
}

export async function staffRedeemRoute(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    attendee_id?: unknown;
    reward_id?: unknown;
    request_id?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const attendeeId = requiredString(body.attendee_id, "attendee_id");
  const rewardId = requiredString(body.reward_id, "reward_id");
  const requestId = requiredString(body.request_id ?? crypto.randomUUID(), "request_id");
  const result = await redeemReward({
    actor,
    eventId,
    attendeeId,
    rewardId,
    requestId,
    staffId: actor.id
  });

  return c.json({ result }, statusCode(result.status));
}

export async function reverseRedemptionRoute(c: Context) {
  const actor = c.get("actor") as Actor;
  const redemptionId = requiredString(c.req.param("id"), "id");
  const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = requiredString(body.reason, "reason");

  const result = await withSerializable(() =>
    sql.begin("isolation level serializable", async (tx) => {
      const redemptionRows = await tx<
        Array<{
          id: string;
          event_id: string;
          attendee_id: string;
          reward_id: string;
          state: "completed" | "pending_booking" | "reversed";
        }>
      >`
        select id, event_id, attendee_id, reward_id, state
        from public.redemption_records
        where id = ${redemptionId}
        for update
      `;
      const redemption = redemptionRows[0];

      if (!redemption) {
        throw new HTTPException(404, { message: "Redemption not found" });
      }

      if (redemption.state === "reversed") {
        return { ok: true, already_reversed: true };
      }

      const rewardRows = await tx<{ cost: number }[]>`
        select cost from public.rewards where id = ${redemption.reward_id} for update
      `;
      const reward = rewardRows[0];

      if (!reward) {
        throw new HTTPException(404, { message: "Reward not found" });
      }

      await tx`
        update public.rewards
        set inventory = inventory + 1,
            updated_at = now()
        where id = ${redemption.reward_id}
      `;

      if (redemption.state === "completed") {
        await tx`
          update public.attendees
          set spendable_balance = spendable_balance + ${reward.cost},
              updated_at = now()
          where id = ${redemption.attendee_id}
        `;
      }

      await tx`
        update public.redemption_records
        set state = 'reversed',
            reason = ${reason},
            reversed_at = now(),
            reversed_by_user_id = ${actor.id}
        where id = ${redemption.id}
      `;

      await tx`
        insert into public.audit_logs (
          actor_user_id, actor_role, action, target_type, target_id, reason, metadata
        )
        values (
          ${actor.id},
          ${actor.role}::public.app_role,
          'reward.reversed',
          'redemption_record',
          ${redemption.id},
          ${reason},
          ${JSON.stringify({ reward_id: redemption.reward_id, restored_cost: reward.cost })}::jsonb
        )
      `;

      return { ok: true, already_reversed: false };
    })
  );

  return c.json(result);
}

export async function claimWilliamRoute(c: Context) {
  const actor = c.get("actor") as Actor;
  const body = (await c.req.json().catch(() => ({}))) as {
    event_id?: unknown;
    reward_id?: unknown;
    request_id?: unknown;
  };
  const eventId = requiredString(body.event_id, "event_id");
  const rewardId = optionalString(body.reward_id);
  const attendee = await attendeeForActor(eventId, actor);

  const result = await withSerializable(() =>
    sql.begin("isolation level serializable", async (tx) => {
      const rewardRows = await tx<RewardRow[]>`
        select id, event_id, name, type, cost, inventory, per_attendee_limit, expires_at
        from public.rewards
        where event_id = ${eventId}
          and type = 'william_premium'
          ${rewardId ? sql`and id = ${rewardId}` : sql``}
        for update
        limit 1
      `;
      const reward = rewardRows[0];

      if (!reward) {
        throw new HTTPException(404, { message: "William reward not found" });
      }

      const existing = await tx<{ id: string }[]>`
        select id
        from public.redemption_records
        where event_id = ${eventId}
          and attendee_id = ${attendee.id}
          and reward_id = ${reward.id}
          and state <> 'reversed'
        limit 1
      `;

      if (existing[0]) {
        return {
          status: "pending_booking",
          redemptionId: existing[0].id,
          cost: reward.cost,
          newBalance: attendee.spendable_balance
        } satisfies RedemptionResult;
      }

      if (reward.inventory <= 0) {
        return { status: "sold_out" } satisfies RedemptionResult;
      }

      const redemptionRows = await tx<{ id: string }[]>`
        insert into public.redemption_records (
          event_id,
          attendee_id,
          reward_id,
          state,
          request_id
        )
        values (${eventId}, ${attendee.id}, ${reward.id}, 'pending_booking', ${optionalString(body.request_id)})
        returning id
      `;
      const redemption = redemptionRows[0];

      await tx`
        insert into public.redemption_holds (
          event_id,
          attendee_id,
          reward_id,
          redemption_id,
          expires_at
        )
        values (${eventId}, ${attendee.id}, ${reward.id}, ${redemption?.id}, now() + interval '30 minutes')
      `;

      await tx`
        insert into public.audit_logs (
          actor_user_id, actor_role, action, target_type, target_id, reason, metadata
        )
        values (
          ${actor.id},
          ${actor.role}::public.app_role,
          'william.claimed',
          'reward',
          ${reward.id},
          'pending_calendly_booking',
          ${JSON.stringify({ attendee_id: attendee.id, cost: reward.cost })}::jsonb
        )
      `;

      return {
        status: "pending_booking",
        redemptionId: redemption?.id ?? "",
        cost: reward.cost,
        newBalance: attendee.spendable_balance
      } satisfies RedemptionResult;
    })
  );

  return c.json({ result }, statusCode(result.status));
}

export async function completeWilliamBooking(input: {
  eventSlug: string;
  attendeeEmail: string;
  calendlyEventId: string;
  actor?: Actor;
}) {
  return withSerializable(() =>
    sql.begin("isolation level serializable", async (tx) => {
      const rows = await tx<
        Array<{
          event_id: string;
          attendee_id: string;
          reward_id: string;
          redemption_id: string;
          cost: number;
          spendable_balance: number;
          state: "completed" | "pending_booking" | "reversed";
        }>
      >`
        select
          h.event_id,
          h.attendee_id,
          h.reward_id,
          h.redemption_id,
          r.cost,
          a.spendable_balance,
          rr.state
        from public.redemption_holds h
        join public.events e on e.id = h.event_id
        join public.attendees a on a.id = h.attendee_id
        join public.rewards r on r.id = h.reward_id
        join public.redemption_records rr on rr.id = h.redemption_id
        where e.slug = ${input.eventSlug}
          and lower(a.email) = lower(${input.attendeeEmail})
          and rr.state <> 'reversed'
        for update of h, rr, a, r
        limit 1
      `;
      const hold = rows[0];

      if (!hold) {
        throw new HTTPException(404, { message: "William hold not found" });
      }

      if (hold.state === "completed") {
        const existing = await tx<{ id: string }[]>`
          select id from public.redemption_records where id = ${hold.redemption_id}
        `;
        return { ok: true, redemptionId: existing[0]?.id ?? hold.redemption_id, already_completed: true };
      }

      if (hold.spendable_balance < hold.cost) {
        throw new HTTPException(400, { message: "insufficient_balance" });
      }

      const rewardUpdate = await tx<{ inventory: number }[]>`
        update public.rewards
        set inventory = inventory - 1,
            updated_at = now()
        where id = ${hold.reward_id}
          and inventory > 0
        returning inventory
      `;

      if (!rewardUpdate[0]) {
        throw new HTTPException(400, { message: "sold_out" });
      }

      const attendeeUpdate = await tx<{ spendable_balance: number }[]>`
        update public.attendees
        set spendable_balance = spendable_balance - ${hold.cost},
            updated_at = now()
        where id = ${hold.attendee_id}
          and spendable_balance >= ${hold.cost}
        returning spendable_balance
      `;

      if (!attendeeUpdate[0]) {
        throw new HTTPException(400, { message: "insufficient_balance" });
      }

      await tx`
        update public.redemption_records
        set state = 'completed',
            calendly_event_id = ${input.calendlyEventId},
            completed_at = now()
        where id = ${hold.redemption_id}
      `;

      await tx`
        insert into public.audit_logs (
          actor_user_id, actor_role, action, target_type, target_id, reason, metadata
        )
        values (
          ${input.actor?.id ?? null},
          ${(input.actor?.role ?? "admin")}::public.app_role,
          'william.completed',
          'redemption_record',
          ${hold.redemption_id},
          'calendly_confirmed',
          ${JSON.stringify({
            attendee_id: hold.attendee_id,
            calendly_event_id: input.calendlyEventId,
            new_balance: attendeeUpdate[0].spendable_balance
          })}::jsonb
        )
      `;

      return { ok: true, redemptionId: hold.redemption_id, already_completed: false };
    })
  );
}

function webhookSignature(payload: string) {
  return createHmac("sha256", env.CALENDLY_WEBHOOK_SECRET).update(payload).digest("hex");
}

export function verifyCalendlySignature(payload: string, signature: string | null) {
  if (!signature) return false;
  const expected = webhookSignature(payload);

  try {
    const left = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const right = Buffer.from(expected, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export async function calendlyWebhookRoute(c: Context) {
  const eventSlug = requiredString(c.req.param("eventSlug"), "eventSlug");
  const payload = await c.req.text();
  const signature = c.req.header("x-sgexpo-signature") ?? c.req.header("calendly-webhook-signature") ?? null;

  if (!verifyCalendlySignature(payload, signature)) {
    throw new HTTPException(401, { message: "Invalid webhook signature" });
  }

  const parsed = JSON.parse(payload) as {
    event_id?: string;
    calendly_event_id?: string;
    email?: string;
    payload?: {
      email?: string;
      invitee?: { email?: string };
      event?: string;
      uri?: string;
    };
  };
  const attendeeEmail = requiredString(
    parsed.email ?? parsed.payload?.email ?? parsed.payload?.invitee?.email,
    "email"
  );
  const calendlyEventId = requiredString(
    parsed.calendly_event_id ?? parsed.event_id ?? parsed.payload?.event ?? parsed.payload?.uri,
    "calendly_event_id"
  );
  const result = await completeWilliamBooking({
    eventSlug,
    attendeeEmail,
    calendlyEventId
  });

  return c.json(result);
}
