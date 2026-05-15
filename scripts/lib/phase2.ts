import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

config({ path: ".env.local" });

export const databaseUrl = process.env.DATABASE_URL;
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const jwtSecret = process.env.SUPABASE_JWT_SECRET;
export const backendBaseUrl =
  process.env.BACKEND_URL?.replace(/\/health$/, "") ?? "http://localhost:8081";

if (!databaseUrl || !supabaseUrl || !anonKey || !serviceRoleKey || !jwtSecret) {
  throw new Error("Phase 2 scripts require Supabase and database env vars");
}

export const sql = postgres(databaseUrl, { max: 2 });

export const supabaseAnon = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function getEventId(slug = "sge-2026") {
  const rows = await sql<{ id: string }[]>`
    select id from public.events where slug = ${slug} limit 1
  `;

  if (!rows[0]) {
    throw new Error(`${slug} is not seeded`);
  }

  return rows[0].id;
}

export async function anonymousSession() {
  const { data, error } = await supabaseAnon.auth.signInAnonymously();

  if (error || !data.session || !data.user) {
    throw error ?? new Error("Anonymous sign-in did not return a session");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    userId: data.user.id
  };
}

export async function closeSql() {
  await sql.end();
}
