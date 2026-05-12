import { anonymousSession, backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();
const session = await anonymousSession();
const email = `anon-upgrade-${Date.now()}@example.test`;

const upsert = await fetch(`${backendBaseUrl}/attendees/upsert`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId })
});

if (!upsert.ok) {
  throw new Error(`Upsert failed with ${upsert.status}`);
}

await sql`
  update auth.users
  set email = ${email},
      is_anonymous = false,
      email_confirmed_at = now(),
      updated_at = now()
  where id = ${session.userId}
`;

const rows = await sql<{ auth_user_id: string; is_verified: boolean; email: string | null }[]>`
  select auth_user_id, is_verified, email
  from public.attendees
  where event_id = ${eventId}
    and auth_user_id = ${session.userId}
`;

if (rows[0]?.auth_user_id !== session.userId || !rows[0].is_verified || rows[0].email !== email) {
  throw new Error("Anonymous user was not verified in place");
}

await closeSql();
console.log("Anon-to-verified checks passed.");
