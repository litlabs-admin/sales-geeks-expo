import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const sql = postgres(databaseUrl, { max: 1 });
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function ensureUser(email: string, role: "admin" | "staff") {
  const existing = await sql<{ id: string }[]>`
    select id from public.users where email = ${email} limit 1
  `;

  let userId = existing[0]?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true
    });

    if (error) {
      throw error;
    }

    userId = data.user.id;
  }

  await sql`
    update public.users
    set role = ${role}::public.app_role,
        updated_at = now()
    where id = ${userId}
  `;
}

await sql`
  insert into public.events (slug, name, starts_at, ends_at)
  values (
    'sge-2026',
    'Scottish Growth Expo 2026',
    '2026-05-26T08:30:00+01:00',
    '2026-05-26T17:00:00+01:00'
  )
  on conflict (slug) do nothing
`;

await ensureUser(process.env.DEV_ADMIN_EMAIL ?? "admin+sgexpo@litlabs.io", "admin");
await ensureUser(process.env.DEV_STAFF_EMAIL ?? "staff+sgexpo@litlabs.io", "staff");

await sql.end();
console.log("Seeded base Phase 0 data.");
