import { closeSql, getEventId, sql } from "./lib/phase2";
import { closePhase5, insertQr } from "./lib/phase5";

const eventId = await getEventId();

await sql`delete from public.scan_records where event_id = ${eventId}`;
await sql`delete from public.qr_codes where event_id = ${eventId} and owner_type = 'misc'`;

for (let index = 1; index <= 6; index += 1) {
  await insertQr({
    eventId,
    type: "sponsor",
    reason: `Sponsor QR ${index}`,
    points: 10
  });
}

for (let index = 1; index <= 4; index += 1) {
  await insertQr({
    eventId,
    type: "session",
    reason: `Session QR ${index}`,
    points: 15
  });
}

await insertQr({
  eventId,
  type: "hidden_bonus",
  reason: "Hidden bonus revealed",
  points: 25,
  revealAt: "2026-05-01T09:00:00.000Z",
  zoneHint: "Near the registration desk"
});

await insertQr({
  eventId,
  type: "hidden_bonus",
  reason: "Hidden bonus future A",
  points: 25,
  revealAt: "2026-06-01T09:00:00.000Z",
  zoneHint: "Look up near the main stage"
});

await insertQr({
  eventId,
  type: "hidden_bonus",
  reason: "Hidden bonus future B",
  points: 25,
  revealAt: "2026-06-01T10:00:00.000Z",
  zoneHint: "Somewhere on the expo floor"
});

await insertQr({
  eventId,
  type: "session",
  reason: "Inactive QR",
  points: 15,
  active: false
});

await closePhase5();
await closeSql();
console.log("Seeded Phase 5 QR mix.");
