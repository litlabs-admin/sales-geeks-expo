import { anonymousSession, backendBaseUrl, closeSql, getEventId, sql } from "./lib/phase2";
import { activeQr, closePhase5, redis } from "./lib/phase5";

const eventId = await getEventId();
const qr = await activeQr(eventId, "sponsor");
const session = await anonymousSession();

await redis.del(`scan-rate:${session.userId}`);

const pending = await fetch(`${backendBaseUrl}/scan/presignup`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId, qr_code_id: qr.id })
});
if (!pending.ok) throw new Error(`Pending scan returned ${pending.status}`);

const upsert = await fetch(`${backendBaseUrl}/attendees/upsert`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ event_id: eventId, real_name: "Presignup Replay" })
});
if (!upsert.ok) throw new Error(`Attendee upsert returned ${upsert.status}`);

const rows = await sql<{ competition_score: number; scans: number }[]>`
  select
    a.competition_score,
    (select count(*)::int from public.scan_records where attendee_id = a.id and qr_code_id = ${qr.id}) as scans
  from public.attendees a
  where a.event_id = ${eventId}
    and a.auth_user_id = ${session.userId}
  limit 1
`;

if (rows[0]?.competition_score !== qr.points || rows[0].scans !== 1) {
  throw new Error(`Pending scan was not replayed: ${JSON.stringify(rows[0])}`);
}

await closePhase5();
await closeSql();
console.log("Pre-signup scan replay checks passed.");
