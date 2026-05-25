/**
 * Replace the SGE 2026 agenda with the official agenda from the partner deck
 * (Scottish Growth Partners Deck, pages 9–10).
 *
 * Usage:
 *   pnpm tsx scripts/seed-sge-agenda.ts
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const EVENT_SLUG = "sge-2026";
const eventId = await getEventId(EVENT_SLUG);

// All times in BST (UTC+1) on 26 May 2026.
const AGENDA = [
  {
    title: "Registration Opens",
    description: "Doors open — collect your badge, settle in, and meet the room. Registration continues all day.",
    stage: "Entrance",
    category: "Operations",
    type: "registration",
    starts: "2026-05-26T08:30:00+01:00",
    ends:   "2026-05-26T09:00:00+01:00"
  },
  {
    title: "Exhibition Floor Opens",
    description: "40 stands live — sponsors, partners and curated exhibitors. Scan a QR code for points.",
    stage: "Expo Floor",
    category: "Networking",
    type: "expo",
    starts: "2026-05-26T09:00:00+01:00",
    ends:   "2026-05-26T09:30:00+01:00"
  },
  {
    title: "Opening Address — Lorna Farrell",
    description: "Success, Setbacks & Redefining What Really Matters.",
    stage: "Auditorium",
    category: "Keynote",
    type: "keynote",
    starts: "2026-05-26T09:30:00+01:00",
    ends:   "2026-05-26T10:30:00+01:00"
  },
  {
    title: "Keynote — Katy Morrison",
    description: "The importance of Culture & Values in Modern Business.",
    stage: "Auditorium",
    category: "Keynote",
    type: "keynote",
    starts: "2026-05-26T11:20:00+01:00",
    ends:   "2026-05-26T12:00:00+01:00"
  },
  {
    title: "Networking & Exhibition",
    description: "Refuel, meet sponsors, swap QR codes.",
    stage: "Expo Floor",
    category: "Networking",
    type: "networking",
    starts: "2026-05-26T12:00:00+01:00",
    ends:   "2026-05-26T13:00:00+01:00"
  },
  {
    title: "Keynote — Brian Williamson",
    description: "Entrepreneurialism — What It Actually Means · Real Growth Stories.",
    stage: "Auditorium",
    category: "Keynote",
    type: "keynote",
    starts: "2026-05-26T13:00:00+01:00",
    ends:   "2026-05-26T14:00:00+01:00"
  },
  {
    title: "Private VIP Q&A Session",
    description: "Invite only.",
    stage: "VIP Suite",
    category: "VIP",
    type: "qa",
    starts: "2026-05-26T14:15:00+01:00",
    ends:   "2026-05-26T15:00:00+01:00"
  },
  {
    title: "Keynote — Russell Dalgliesh",
    description: "Community, Collaboration & Future Growth.",
    stage: "Auditorium",
    category: "Keynote",
    type: "keynote",
    starts: "2026-05-26T14:45:00+01:00",
    ends:   "2026-05-26T15:45:00+01:00"
  },
  {
    title: "Closing Remarks",
    description: "Close out the formal programme.",
    stage: "Auditorium",
    category: "Operations",
    type: "closing",
    starts: "2026-05-26T15:45:00+01:00",
    ends:   "2026-05-26T16:00:00+01:00"
  },
  {
    title: "Networking & Breakdown",
    description: "Drinks, connections, last scans before the day winds down.",
    stage: "Expo Floor",
    category: "Networking",
    type: "networking",
    starts: "2026-05-26T16:00:00+01:00",
    ends:   "2026-05-26T17:30:00+01:00"
  }
];

console.log(`Resetting agenda for event ${eventId}`);
await sql`delete from public.agenda_sessions where event_id = ${eventId}`;

for (const item of AGENDA) {
  await sql`
    insert into public.agenda_sessions (
      event_id, title, description, stage, category, type, starts_at, ends_at
    ) values (
      ${eventId},
      ${item.title},
      ${item.description},
      ${item.stage},
      ${item.category},
      ${item.type},
      ${item.starts},
      ${item.ends}
    )
  `;
  console.log(`  ✓ ${item.title} (${item.starts.slice(11, 16)})`);
}

await closeSql();
console.log(`\nDone — ${AGENDA.length} sessions seeded.`);
