import { closeSql, getEventId, sql } from "./lib/phase2";
import {
  activeQr,
  attendeeToken,
  closePhase5,
  firstAttendee,
  postScan,
  resetAttendeeForQr,
  redis
} from "./lib/phase5";

const eventId = await getEventId();
const attendee = await firstAttendee(eventId);
const qr = await activeQr(eventId, "session");
const token = await attendeeToken(attendee);

await resetAttendeeForQr(attendee.id, qr.id);
await redis.del(`scan:${attendee.id}:${qr.id}`);

const responses = await Promise.all(
  Array.from({ length: 50 }, () =>
    postScan({
      token,
      qr,
      bypassRedis: true,
      bypassRateLimit: true
    })
  )
);

if (responses.some((response) => response.status !== 200)) {
  throw new Error(`Expected redis-bypass responses to be 200, saw ${responses.map((r) => r.status).join(",")}`);
}

const rows = await sql<{ scans: number; competition_score: number; spendable_balance: number }[]>`
  select
    (select count(*)::int from public.scan_records where attendee_id = ${attendee.id} and qr_code_id = ${qr.id}) as scans,
    competition_score,
    spendable_balance
  from public.attendees
  where id = ${attendee.id}
`;
const result = rows[0];

if (result?.scans !== 1 || result.competition_score !== qr.points || result.spendable_balance !== qr.points) {
  throw new Error(`DB unique constraint did not prevent double credit: ${JSON.stringify(result)}`);
}

await closePhase5();
await closeSql();
console.log("Redis-bypass DB idempotency checks passed.");
