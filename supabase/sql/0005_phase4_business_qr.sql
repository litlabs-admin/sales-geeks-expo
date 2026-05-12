do $$
begin
  create type public.qr_owner_type as enum ('business', 'misc');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.qr_code_type as enum ('business', 'guest_speaker', 'ad_hoc_session', 'bonus_zone');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  contact_email text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_type public.qr_owner_type not null,
  owner_id uuid,
  type public.qr_code_type not null,
  code text not null unique,
  signature text not null,
  points integer not null default 0,
  reveal_at timestamptz,
  expires_at timestamptz,
  zone_hint text,
  reason text,
  purpose_fingerprint text not null,
  active boolean not null default true,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_business_owner_required check (
    (owner_type = 'business' and owner_id is not null and type = 'business')
    or (owner_type = 'misc' and type <> 'business')
  )
);

create unique index if not exists qr_codes_one_business_qr_idx
  on public.qr_codes (event_id, owner_id)
  where owner_type = 'business';

create unique index if not exists qr_codes_owner_purpose_idx
  on public.qr_codes (
    event_id,
    owner_type,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    purpose_fingerprint
  );

create index if not exists businesses_event_idx on public.businesses using btree (event_id, name);
create index if not exists qr_codes_event_idx on public.qr_codes using btree (event_id, type, active);

alter table public.businesses enable row level security;
alter table public.qr_codes enable row level security;

do $$
begin
  create policy "businesses_read_authenticated"
    on public.businesses
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "qr_codes_read_authenticated"
    on public.qr_codes
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
before update on public.businesses
for each row
execute function public.set_updated_at();

drop trigger if exists set_qr_codes_updated_at on public.qr_codes;
create trigger set_qr_codes_updated_at
before update on public.qr_codes
for each row
execute function public.set_updated_at();
