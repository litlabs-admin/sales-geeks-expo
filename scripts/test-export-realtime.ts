import { closeSql, getEventId, sql } from "./lib/phase2";
import { activeQr, firstAttendee } from "./lib/phase5";
import { exportCsv } from "./lib/phase8";

const eventId = await getEventId();
const attendee = await firstAttendee(eventId);
const qr = await activeQr(eventId);

await sql`
  insert into public.scan_records (
    event_id,
    attendee_id,
    qr_code_id,
    points_competition,
    points_spendable
  )
  values (${eventId}, ${attendee.id}, ${qr.id}, ${qr.points}, ${qr.points})
  on conflict (attendee_id, qr_code_id) do nothing
`;

const before = Date.now();
const result = await exportCsv("scans", eventId);
const asOf = result.asOf ? new Date(result.asOf).getTime() : 0;

if (!result.text.includes(qr.code)) {
  throw new Error("Realtime scan export did not include the committed scan");
}

if (Math.abs(asOf - before) > 5000) {
  throw new Error(`Export as_of was not within 5s of now: ${result.asOf}`);
}

await closeSql();
console.log("Realtime export checks passed.");
