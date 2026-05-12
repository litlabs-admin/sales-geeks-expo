import { closeSql, getEventId, sql } from "./lib/phase2";
import {
  attendeeToken,
  closePhase5,
  firstAttendee,
  insertQr,
  postScan,
  resetAttendeeForQr,
  redis
} from "./lib/phase5";

const eventId = await getEventId();
const attendee = await firstAttendee(eventId);
const token = await attendeeToken(attendee);

await resetAttendeeForQr(attendee.id);
await redis.del(`scan-rate:${attendee.id}`);

const qrs = [];
for (let index = 1; index <= 11; index += 1) {
  const qr = await insertQr({
    eventId,
    type: "session",
    reason: `Rate limit QR ${Date.now()} ${index}`,
    points: 1
  });
  qrs.push(qr);
}

const statuses: number[] = [];
for (const qr of qrs) {
  const response = await postScan({ token, qr });
  statuses.push(response.status);
}

if (statuses.slice(0, 10).some((status) => status !== 200) || statuses[10] !== 429) {
  throw new Error(`Expected 10 successful scans then 429, saw ${statuses.join(",")}`);
}

await sql`delete from public.qr_codes where event_id = ${eventId} and reason like 'Rate limit QR %'`;
await closePhase5();
await closeSql();
console.log("Scan rate-limit checks passed.");
