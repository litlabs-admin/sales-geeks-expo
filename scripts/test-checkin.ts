import { anonymousSession, backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();
const session = await anonymousSession();

await sql`
  update public.events
  set lifecycle_state = 'event_day'
  where id = ${eventId}
`;

async function upsert() {
  const response = await fetch(`${backendBaseUrl}/attendees/upsert`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ event_id: eventId })
  });

  if (!response.ok) {
    throw new Error(`Upsert failed with ${response.status}`);
  }
}

await upsert();
const first = await sql<{ checked_in_at: string | null }[]>`
  select checked_in_at
  from public.attendees
  where event_id = ${eventId}
    and auth_user_id = ${session.userId}
`;

await new Promise((resolve) => setTimeout(resolve, 1000));
await upsert();

const second = await sql<{ checked_in_at: string | null }[]>`
  select checked_in_at
  from public.attendees
  where event_id = ${eventId}
    and auth_user_id = ${session.userId}
`;

if (!first[0]?.checked_in_at) {
  throw new Error("First event-day request did not check attendee in");
}

if (new Date(first[0].checked_in_at).getTime() !== new Date(second[0]?.checked_in_at ?? 0).getTime()) {
  throw new Error("Second event-day request changed checked_in_at");
}

await sql`
  update public.events
  set lifecycle_state = 'pre_event'
  where id = ${eventId}
`;

await closeSql();
console.log("Check-in checks passed.");
