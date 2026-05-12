import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId();

await sql`delete from public.announcements where event_id = ${eventId}`;
await sql`delete from public.sponsor_interest where event_id = ${eventId}`;
await sql`delete from public.agenda_sessions where event_id = ${eventId}`;
await sql`delete from public.faqs where event_id = ${eventId}`;
await sql`delete from public.geeks where event_id = ${eventId}`;
await sql`delete from public.sponsors where event_id = ${eventId}`;

const geekRows = await sql<{ id: string; name: string }[]>`
  insert into public.geeks (event_id, name, bio, contact_email, calendly_url, is_william, sort_order)
  values
    (${eventId}, 'William', 'SalesGeek host with a premium post-event strategy reward.', 'william@salesgeek.scot', 'https://calendly.com/william-salesgeek', true, 1),
    (${eventId}, 'Katy', 'Host focused on growth conversations and practical introductions.', 'katy@salesgeek.scot', 'https://calendly.com/katy-salesgeek', false, 2),
    (${eventId}, 'Brian', 'Host supporting sponsor and attendee networking.', 'brian@salesgeek.scot', 'https://calendly.com/brian-salesgeek', false, 3),
    (${eventId}, 'Russell', 'Host helping leaders turn conversations into next steps.', 'russell@salesgeek.scot', 'https://calendly.com/russell-salesgeek', false, 4)
  returning id, name
`;

const sponsorRows = await sql<{ id: string; name: string }[]>`
  insert into public.sponsors (event_id, name, tier, page_html, lead_capture_enabled, sort_order)
  values
    (${eventId}, 'Strategic Headline Partner', 'Strategic Headline', '<p>Headline partner profile.</p>', true, 1),
    (${eventId}, 'Growth Ecosystem Partner', 'Growth Ecosystem', '<p>Growth ecosystem partner profile.</p>', true, 2),
    (${eventId}, 'Experience Sponsor A', 'Experience Sponsor', '<p>Experience sponsor profile.</p>', true, 3),
    (${eventId}, 'Experience Sponsor B', 'Experience Sponsor', '<p>Experience sponsor profile.</p>', false, 4),
    (${eventId}, 'Curated Exhibitor A', 'Curated Exhibitor', '<p>Curated exhibitor profile.</p>', true, 5),
    (${eventId}, 'Curated Exhibitor B', 'Curated Exhibitor', '<p>Curated exhibitor profile.</p>', false, 6)
  returning id, name
`;

const william = geekRows.find((geek) => geek.name === "William")?.id ?? null;
const headlineSponsor = sponsorRows[0]?.id ?? null;

await sql`
  insert into public.agenda_sessions (
    event_id, title, description, stage, category, type, starts_at, ends_at, speaker_id, sponsor_id
  )
  values
    (${eventId}, 'Registration Opens', 'Arrive, collect badge, and meet the room.', 'Entrance', 'Operations', 'registration', '2026-05-26T08:30:00+01:00', '2026-05-26T09:00:00+01:00', null, null),
    (${eventId}, 'Exhibition Opens', 'Sponsors and exhibitors open their stands.', 'Expo Floor', 'Networking', 'expo', '2026-05-26T09:00:00+01:00', '2026-05-26T10:00:00+01:00', null, ${headlineSponsor}),
    (${eventId}, 'Growth Welcome', 'Opening context for the day.', 'Main Stage', 'Keynote', 'keynote', '2026-05-26T10:00:00+01:00', '2026-05-26T10:30:00+01:00', ${william}, null),
    (${eventId}, 'Katy Morrison', 'Speaker session.', 'Main Stage', 'Keynote', 'keynote', '2026-05-26T11:20:00+01:00', '2026-05-26T12:00:00+01:00', null, null),
    (${eventId}, 'Lunch Networking', 'Meet sponsors and peers.', 'Expo Floor', 'Networking', 'networking', '2026-05-26T12:00:00+01:00', '2026-05-26T13:00:00+01:00', null, null),
    (${eventId}, 'Brian Williamson', 'Main afternoon keynote.', 'Main Stage', 'Keynote', 'keynote', '2026-05-26T13:00:00+01:00', '2026-05-26T14:00:00+01:00', null, null),
    (${eventId}, 'VIP Q&A', 'Invite-only Q&A session.', 'VIP Suite', 'VIP', 'qa', '2026-05-26T14:15:00+01:00', '2026-05-26T15:00:00+01:00', null, null),
    (${eventId}, 'Russell Dalgliesh', 'Closing keynote.', 'Main Stage', 'Keynote', 'keynote', '2026-05-26T14:45:00+01:00', '2026-05-26T15:45:00+01:00', null, null)
`;

for (let index = 1; index <= 12; index += 1) {
  await sql`
    insert into public.faqs (event_id, question, answer, sort_order)
    values (
      ${eventId},
      ${`FAQ ${index}: Where do I find ${index === 2 ? "parking" : "event information"}?`},
      ${index === 2 ? "Parking details are available at the venue desk." : "The event team can help at registration."},
      ${index}
    )
  `;
}

await sql`
  insert into public.announcements (event_id, title, body)
  values (${eventId}, 'Welcome to Scottish Growth Expo', 'Use the app for agenda, Geeks, sponsors, and FAQs.')
`;

await closeSql();
console.log("Seeded Phase 3 content.");
