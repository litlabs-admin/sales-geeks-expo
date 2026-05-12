import type { Actor } from "./rbac";

export type AuditTarget = {
  type: string;
  id?: string;
};

export type AuditWriter = {
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

export async function withAudit<T>(
  tx: AuditWriter,
  actor: Actor,
  action: string,
  target: AuditTarget,
  reason: string | undefined,
  fn: () => Promise<T>
) {
  const result = await fn();

  await tx.insertAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action,
    targetType: target.type,
    targetId: target.id,
    reason,
    metadata: {}
  });

  return result;
}
