import { closeSql, getEventId, sql, supabaseAdmin } from "./lib/phase2";

const eventId = await getEventId();

for (let index = 1; index <= 20; index += 1) {
  const email = `attendee-${index}@example.test`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      seed: "phase2"
    }
  });

  if (error && error.code !== "email_exists" && !error.message.includes("already registered")) {
    throw error;
  }

  const existing = await sql<{ id: string }[]>`
    select id from auth.users where email = ${email} limit 1
  `;
  const userId = data.user?.id ?? existing[0]?.id;

  if (!userId) {
    throw new Error(`Could not resolve auth user for ${email}`);
  }

  await sql`
    insert into public.attendees (
      event_id,
      auth_user_id,
      email,
      real_name,
      business_name,
      alias,
      is_verified
    )
    values (
      ${eventId},
      ${userId},
      ${email},
      ${`Attendee ${index}`},
      'Seed Business',
      ${`Seed-${index}`},
      true
    )
    on conflict (event_id, auth_user_id) do update
      set real_name = excluded.real_name,
          business_name = excluded.business_name,
          is_verified = true,
          updated_at = now()
  `;
}

await closeSql();
console.log("Seeded 20 verified Phase 2 attendees.");
