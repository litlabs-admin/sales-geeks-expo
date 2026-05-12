do $$
begin
  create type public.app_role as enum ('attendee', 'staff', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'attendee',
  real_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role public.app_role not null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_slug_idx on public.events using btree (slug);
create index if not exists users_email_idx on public.users using btree (email);
create index if not exists audit_logs_target_idx on public.audit_logs using btree (target_type, target_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs using btree (created_at desc);

alter table public.events enable row level security;
alter table public.users enable row level security;
alter table public.audit_logs enable row level security;

create or replace view public.events_public as
select id, slug, name, starts_at, ends_at
from public.events;

grant select on public.events_public to anon, authenticated;

do $$
begin
  create policy "events_public_select_anon"
    on public.events
    for select
    to anon, authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create or replace function public.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, coalesce(new.email, ''), 'attendee')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_auth_user_on_insert on auth.users;
create trigger sync_auth_user_on_insert
after insert or update of email on auth.users
for each row
execute function public.sync_auth_user();

revoke update, delete on public.audit_logs from anon, authenticated;
