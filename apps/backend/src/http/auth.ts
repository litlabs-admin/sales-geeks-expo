import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type { Actor, Role } from "@sgexpo/domain/rbac";
import { hasRequiredRole } from "@sgexpo/domain/rbac";
import { env } from "../env";

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

export async function requireSupabaseJwt(c: Context, next: Next) {
  const token = getBearerToken(c.req.header("authorization"));

  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }

  try {
    const { payload } = await verifySupabaseJwt(token);
    const role = (payload.app_role === "admin" || payload.app_role === "staff"
      ? payload.app_role
      : "attendee") as Role;

    const email = typeof payload.email === "string" && payload.email.trim() ? payload.email : undefined;

    c.set("actor", {
      id: String(payload.sub),
      email,
      role
    });

    await next();
  } catch {
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
