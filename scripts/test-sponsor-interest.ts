import { anonymousSession, backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();
const session = await anonymousSession();

const upsert = await fetch(`${backendBaseUrl}/attendees/upsert`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId })
});
if (!upsert.ok) throw new Error(`Attendee upsert failed with ${upsert.status}`);

const sponsors = await sql<{ id: string }[]>`
  select id from public.sponsors where event_id = ${eventId} order by sort_order asc limit 1
`;
const attendeeRows = await sql<{ id: string; competition_score: number }[]>`
  select id, competition_score from public.attendees
  where event_id = ${eventId} and auth_user_id = ${session.userId}
  limit 1
`;
const sponsorId = sponsors[0]?.id;
const attendee = attendeeRows[0];
if (!sponsorId || !attendee) throw new Error("Expected seeded sponsor and attendee");

async function post(path: string) {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ event_id: eventId, sponsor_id: sponsorId })
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

await post("/sponsor-interest");
let rows = await sql<{ consented: boolean; undone_at: string | null }[]>`
  select consented, undone_at from public.sponsor_interest
  where event_id = ${eventId} and attendee_id = ${attendee.id} and sponsor_id = ${sponsorId}
`;
if (rows[0]?.consented !== false || rows[0].undone_at !== null) {
  throw new Error("Initial sponsor interest row was not unconsented and active");
}

await post("/sponsor-interest/consent");
rows = await sql<{ consented: boolean; undone_at: string | null }[]>`
  select consented, undone_at from public.sponsor_interest
  where event_id = ${eventId} and attendee_id = ${attendee.id} and sponsor_id = ${sponsorId}
`;
if (rows[0]?.consented !== true) {
  throw new Error("Sponsor consent was not captured separately");
}

await post("/sponsor-interest/undo");
rows = await sql<{ consented: boolean; undone_at: string | null }[]>`
  select consented, undone_at from public.sponsor_interest
  where event_id = ${eventId} and attendee_id = ${attendee.id} and sponsor_id = ${sponsorId}
`;
if (!rows[0]?.undone_at) {
  throw new Error("Sponsor interest was not undone");
}

const finalAttendee = await sql<{ competition_score: number }[]>`
  select competition_score from public.attendees where id = ${attendee.id}
`;
if (finalAttendee[0]?.competition_score !== attendee.competition_score) {
  throw new Error("Sponsor interest changed competition score");
}

await closeSql();
console.log("Sponsor interest checks passed.");
