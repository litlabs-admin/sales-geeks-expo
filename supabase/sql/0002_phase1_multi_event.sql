do $$
begin
  create type public.event_lifecycle_state as enum (
    'pre_event',
    'event_day',
    'post_event_archive'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.events
  add column if not exists lifecycle_state public.event_lifecycle_state not null default 'pre_event',
  add column if not exists brand_tokens jsonb not null default jsonb_build_object(
    'primary', '18 110 130',
    'ink', '18 23 28',
    'logo_url', null
  ),
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;

create index if not exists events_lifecycle_state_idx
  on public.events using btree (lifecycle_state);

drop view if exists public.events_public;

create view public.events_public as
select
  id,
  slug,
  name,
  starts_at,
  ends_at,
  lifecycle_state,
  brand_tokens,
  feature_flags
from public.events;

grant select on public.events_public to anon, authenticated;
