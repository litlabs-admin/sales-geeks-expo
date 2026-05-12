import { closeSql, getEventId, sql } from "./lib/phase2";
import {
  attendeeToken,
  closePhase5,
  firstAttendee,
  postScan,
  resetAttendeeForQr,
  type TestQr
} from "./lib/phase5";

const eventId = await getEventId();
const attendee = await firstAttendee(eventId);
const token = await attendeeToken(attendee);
const futureRows = await sql<TestQr[]>`
  select id, event_id, code, signature, type, points
  from public.qr_codes
  where event_id = ${eventId}
    and type = 'hidden_bonus'
    and reveal_at > now()
  order by reveal_at asc
  limit 1
`;
const qr = futureRows[0];

if (!qr) {
  throw new Error("Seed QRs before running hidden bonus checks");
}

await resetAttendeeForQr(attendee.id, qr.id);

const futureResponse = await postScan({ token, qr });
const futureBody = (await futureResponse.json()) as { result?: { status: string } };
if (futureResponse.status !== 409 || futureBody.result?.status !== "not_yet_active") {
  throw new Error(`Expected not_yet_active, saw ${futureResponse.status} ${JSON.stringify(futureBody)}`);
}

await sql`
  update public.qr_codes
  set reveal_at = now() - interval '1 minute',
      updated_at = now()
  where id = ${qr.id}
`;

const awardedResponse = await postScan({ token, qr });
const awardedBody = (await awardedResponse.json()) as { result?: { status: string } };
if (awardedResponse.status !== 200 || awardedBody.result?.status !== "awarded") {
  throw new Error(`Expected hidden bonus award after reveal, saw ${awardedResponse.status} ${JSON.stringify(awardedBody)}`);
}

await closePhase5();
await closeSql();
console.log("Hidden bonus checks passed.");
