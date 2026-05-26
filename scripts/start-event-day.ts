/**
 * Flip the event lifecycle to event_day so auto-check-in (and any other
 * event_day-gated behaviour) starts working. Also backfills checked_in_at
 * for anyone who already signed in while the event was still pre_event.
 *
 * Usage:
 *   pnpm tsx scripts/start-event-day.ts
 */

import { closeSql, getEventId, sql } from "./lib/phase2";

const eventId = await getEventId("sge-2026");

const before = await sql<Array<{ lifecycle_state: string }>>`
  select lifecycle_state from public.events where id = ${eventId}
`;
console.log(`Before: lifecycle_state = ${before[0]?.lifecycle_state}`);

await sql`
  update public.events
  set lifecycle_state = 'event_day', updated_at = now()
  where id = ${eventId}
`;

const after = await sql<Array<{ lifecycle_state: string }>>`
  select lifecycle_state from public.events where id = ${eventId}
`;
console.log(`After:  lifecycle_state = ${after[0]?.lifecycle_state}`);

// Backfill: anyone who actually signed in (is_verified=true means they
// completed the magic-link flow) before we flipped lifecycle_state needs
// their checked_in_at set retroactively. The 484 CSV-imported attendees
// have is_verified=false until they sign in, so this only touches the
// people who've already arrived/logged in.
const back = await sql`
  update public.attendees
  set checked_in_at = now(), updated_at = now()
  where event_id = ${eventId}
    and checked_in_at is null
    and is_verified = true
`;
console.log(`\nBackfilled checked_in_at on ${back.count} verified attendees.`);

const stats = await sql<Array<{ total: number; checked_in: number }>>`
  select
    count(*)::int as total,
    count(*) filter (where checked_in_at is not null)::int as checked_in
  from public.attendees
  where event_id = ${eventId}
`;
console.log(`\nAttendees now: ${stats[0]?.checked_in} / ${stats[0]?.total} checked in.`);

await closeSql();
