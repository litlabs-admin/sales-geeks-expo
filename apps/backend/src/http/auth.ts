import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type { Actor, Role } from "@sgexpo/domain/rbac";
import { hasRequiredRole } from "@sgexpo/domain/rbac";
import { env } from "../env";
import { sql } from "../db/client";

declare module "hono" {
  interface ContextVariableMap {
    actor: Actor;
  }
}

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function jwtSecret() {
  return new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
}

const supabaseJwks = createRemoteJWKSet(
  new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

async function verifySupabaseJwt(token: string) {
  const header = decodeProtectedHeader(token);

  if (header.alg?.startsWith("ES")) {
    return jwtVerify(token, supabaseJwks);
  }

  return jwtVerify(token, jwtSecret());
}

function isRole(value: unknown): value is Role {
  return value === "attendee" || value === "staff" || value === "admin";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function actorFromVerifiedPayload(payload: Record<string, unknown>): Promise<Actor> {
  const userId = typeof payload.sub === "string" ? payload.sub : "";

  if (!isUuid(userId)) {
    throw new HTTPException(401, { message: "Invalid bearer token" });
  }

  const jwtEmail = typeof payload.email === "string" && payload.email.trim() ? payload.email.trim() : null;
  const rows = await sql<Array<{ id: string; email: string | null; role: Role }>>`
    select id, email, role
    from public.users
    where id = ${userId}
    limit 1
  `;
  let user = rows[0];

  if (!user) {
    const inserted = await sql<Array<{ id: string; email: string | null; role: Role }>>`
      insert into public.users (id, email, role)
      values (${userId}, ${jwtEmail}, 'attendee')
      on conflict (id) do update
        set email = coalesce(public.users.email, excluded.email),
            updated_at = now()
      returning id, email, role
    `;
    user = inserted[0];
  }

  if (!user || !isRole(user.role)) {
    throw new HTTPException(401, { message: "User role is not configured" });
  }

  return {
    id: user.id,
    email: user.email ?? jwtEmail ?? undefined,
    role: user.role
  };
}

export async function requireSupabaseJwt(c: Context, next: Next) {
  const token = getBearerToken(c.req.header("authorization"));

  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }

  try {
    const { payload } = await verifySupabaseJwt(token);
    c.set("actor", await actorFromVerifiedPayload(payload as Record<string, unknown>));

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(401, { message: "Invalid bearer token" });
  }
}

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const actor = c.get("actor");

    if (!hasRequiredRole(actor.role, roles)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    await next();
  };
}
