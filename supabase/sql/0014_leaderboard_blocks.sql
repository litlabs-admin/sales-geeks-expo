-- Timed leaderboards: 3 fixed 2-hour blocks during the event day.
-- For SGE 2026 (26 May 2026): 09:00–11:00, 11:00–13:00, 13:00–15:00 (Europe/London).
--
-- When a block ends, we snapshot the current #1 attendee (by competition_score)
-- and lock them as the block winner. Locking is lazy — happens on first read
-- after block_ends_at. The unique constraint on (event_id, block_key) makes
-- the insert idempotent under races.

create table if not exists public.leaderboard_winners (
  id                uuid        primary key default gen_random_uuid(),
  event_id          uuid        not null references public.events(id) on delete cascade,
  block_key         text        not null,          -- 'block_1' | 'block_2' | 'block_3'
  block_starts_at   timestamptz not null,
  block_ends_at     timestamptz not null,
  attendee_id       uuid        references public.attendees(id) on delete set null,
  alias             text,
  competition_score integer     not null default 0,
  locked_at         timestamptz not null default now(),
  constraint leaderboard_winners_event_block_unique unique (event_id, block_key)
);

create index if not exists leaderboard_winners_event_idx
  on public.leaderboard_winners (event_id);
