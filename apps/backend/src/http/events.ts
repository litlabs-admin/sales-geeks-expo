import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { withAudit } from "@sgexpo/domain/audit";
import {
  assertCanTransition,
  type LifecycleState
} from "@sgexpo/domain/event-lifecycle";
import type { Actor } from "@sgexpo/domain/rbac";
import { sql } from "../db/client";

const lifecycleStates = ["pre_event", "event_day", "post_event_archive"] as const;

function isLifecycleState(value: unknown): value is LifecycleState {
  return typeof value === "string" && lifecycleStates.includes(value as LifecycleState);
}

type AuditTx = {
  insertAuditLog(input: {
    actorUserId?: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
};

function auditWriter(tx: typeof sql): AuditTx {
  return {
    async insertAuditLog(input) {
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
          ${input.actorUserId ?? null},
          ${input.actorRole}::public.app_role,
          ${input.action},
          ${input.targetType},
          ${input.targetId ?? null},
          ${input.reason ?? null},
          ${JSON.stringify(input.metadata ?? {})}::jsonb
        )
      `;
    }
  };
}

export async function listEvents(c: Context) {
  const events = await sql`
    select id, slug, name, starts_at, ends_at, lifecycle_state, brand_tokens, feature_flags
    from public.events
    order by starts_at asc
  `;

  return c.json({ events });
}

export async function transitionEvent(c: Context) {
  const actor = c.get("actor") as Actor;
  const eventId = c.req.param("id");

  if (!eventId) {
    throw new HTTPException(400, { message: "Missing event id" });
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    to?: unknown;
    reason?: unknown;
  };

  const to = body.to;

  if (!isLifecycleState(to)) {
    throw new HTTPException(400, { message: "Invalid lifecycle state" });
  }

  const reason = typeof body.reason === "string" ? body.reason : "Lifecycle transition";

  const result = await sql.begin(async (tx) => {
    const query = tx as unknown as typeof sql;
    const rows = await query<{ lifecycle_state: LifecycleState }[]>`
      select lifecycle_state
      from public.events
      where id = ${eventId}
      for update
    `;

    const current = rows[0];

    if (!current) {
      throw new HTTPException(404, { message: "Event not found" });
    }

    assertCanTransition(current.lifecycle_state, to);

    return withAudit(
      auditWriter(query),
      actor,
      "admin:event.transition",
      { type: "event", id: eventId },
      reason,
      async () => {
        const updated = await query`
          update public.events
          set lifecycle_state = ${to}::public.event_lifecycle_state,
              updated_at = now()
          where id = ${eventId}
          returning id, slug, name, lifecycle_state
        `;

        return updated[0];
      }
    );
  });

  return c.json({ event: result });
}
