do $$
begin
  create type public.reward_type as enum ('standard', 'william_premium');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.redemption_state as enum ('completed', 'pending_booking', 'reversed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  type public.reward_type not null default 'standard',
  cost integer not null,
  inventory integer not null,
  per_attendee_limit integer not null default 1,
  lock_until timestamptz,
  expires_at timestamptz,
  external_provider text,
  redemption_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rewards_inventory_nonnegative check (inventory >= 0),
  constraint rewards_cost_nonnegative check (cost >= 0),
  constraint rewards_limit_positive check (per_attendee_limit > 0),
  unique (event_id, name)
);

create table if not exists public.redemption_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  state public.redemption_state not null,
  staff_id uuid references public.users(id) on delete set null,
  reason text,
  calendly_event_id text,
  request_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  reversed_at timestamptz,
  reversed_by_user_id uuid references public.users(id) on delete set null
);

create table if not exists public.redemption_holds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  redemption_id uuid not null references public.redemption_records(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index if not exists redemption_records_request_unique
  on public.redemption_records (event_id, attendee_id, reward_id, request_id)
  where request_id is not null;

create unique index if not exists redemption_records_calendly_unique
  on public.redemption_records (event_id, calendly_event_id)
  where calendly_event_id is not null;

create unique index if not exists redemption_holds_active_unique
  on public.redemption_holds (event_id, attendee_id, reward_id);

create index if not exists rewards_event_idx
  on public.rewards using btree (event_id, type, inventory);

create index if not exists redemption_records_event_attendee_idx
  on public.redemption_records using btree (event_id, attendee_id, reward_id, state);

alter table public.rewards enable row level security;
alter table public.redemption_records enable row level security;
alter table public.redemption_holds enable row level security;

do $$
begin
  create policy "rewards_read_authenticated"
    on public.rewards
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "redemption_records_own_select"
    on public.redemption_records
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.attendees a
        where a.id = redemption_records.attendee_id
          and a.auth_user_id = auth.uid()
      )
    );
exception
  when duplicate_object then null;
end $$;

drop trigger if exists set_rewards_updated_at on public.rewards;
create trigger set_rewards_updated_at
before update on public.rewards
for each row
execute function public.set_updated_at();
