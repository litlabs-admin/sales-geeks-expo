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

type SeedRole = "admin" | "staff" | "attendee";

async function ensureUser(email: string, role: SeedRole) {
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

  return userId;
}

async function ensureSeedAttendee(input: { eventId: string; userId: string; email: string }) {
  await sql`
    insert into public.attendees (
      event_id,
      auth_user_id,
      email,
      real_name,
      business_name,
      phone,
      alias,
      is_verified,
      checked_in_at
    )
    values (
      ${input.eventId},
      ${input.userId},
      ${input.email},
      'Dev Attendee',
      'Seeded Test Business',
      '+440000000000',
      'Dev-Tester',
      true,
      null
    )
    on conflict (event_id, auth_user_id) do update
      set real_name = excluded.real_name,
          business_name = excluded.business_name,
          phone = excluded.phone,
          alias = excluded.alias,
          is_verified = true,
          updated_at = now()
  `;
}

const events = await sql<{ id: string }[]>`
  insert into public.events (slug, name, starts_at, ends_at)
  values (
    'sge-2026',
    'Scottish Growth Expo 2026',
    '2026-05-26T08:30:00+01:00',
    '2026-05-26T17:00:00+01:00'
  )
  on conflict (slug) do update
    set name = excluded.name,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        updated_at = now()
  returning id
`;

const eventId = events[0]?.id;

if (!eventId) {
  throw new Error("Could not seed sge-2026 event");
}

await ensureUser(process.env.DEV_ADMIN_EMAIL ?? "admin+sgexpo@litlabs.io", "admin");
await ensureUser(process.env.DEV_STAFF_EMAIL ?? "staff+sgexpo@litlabs.io", "staff");

const attendeeEmail = process.env.DEV_ATTENDEE_EMAIL ?? "attendee+sgexpo@litlabs.io";
const attendeeUserId = await ensureUser(attendeeEmail, "attendee");
await ensureSeedAttendee({ eventId, userId: attendeeUserId, email: attendeeEmail });

await sql.end();
console.log("Seeded base event and dev role accounts.");
