-- Attendee-chosen, unique alias.
-- Run AFTER purging seed attendees (see Docs cleanup notes) so the
-- case-insensitive unique index does not collide on 'Seed-*' rows.

-- Tracks whether the attendee has explicitly chosen their alias (vs. the
-- auto-generated "Geek-xxxxxxxx" placeholder). Drives the one-time
-- onboarding screen.
alter table public.attendees
  add column if not exists alias_set boolean not null default false;

-- No two attendees in the same event may share an alias (case-insensitive).
-- If this errors with a duplicate, resolve dupes first:
--   select event_id, lower(alias), count(*) from public.attendees
--   group by 1,2 having count(*) > 1;
create unique index if not exists attendees_event_alias_unique
  on public.attendees (event_id, lower(alias));
