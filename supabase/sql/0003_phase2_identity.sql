create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  real_name text,
  business_name text,
  phone text,
  alias text not null,
  is_verified boolean not null default false,
  checked_in_at timestamptz,
  competition_score integer not null default 0,
  spendable_balance integer not null default 0,
  reached_current_score_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendees_event_auth_user_unique unique (event_id, auth_user_id),
  constraint attendees_score_nonnegative check (competition_score >= 0),
  constraint attendees_spendable_nonnegative check (spendable_balance >= 0)
);

alter table public.users
  alter column email drop not null;

update public.users
set email = null
where email = '';

update public.attendees
set email = null
where email = '';

create unique index if not exists attendees_event_email_unique
  on public.attendees (event_id, lower(email))
  where email is not null;

create index if not exists attendees_event_id_idx
  on public.attendees using btree (event_id);

create index if not exists attendees_auth_user_id_idx
  on public.attendees using btree (auth_user_id);

create table if not exists public.pending_scans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  qr_code_id text not null,
  created_at timestamptz not null default now(),
  constraint pending_scans_auth_qr_unique unique (auth_user_id, qr_code_id)
);

create index if not exists pending_scans_event_auth_idx
  on public.pending_scans using btree (event_id, auth_user_id);

alter table public.attendees enable row level security;
alter table public.pending_scans enable row level security;

do $$
begin
  create policy "attendees_select_own"
    on public.attendees
    for select
    to authenticated
    using (auth_user_id = auth.uid());
exception
  when duplicate_object then null;
end $$;

drop trigger if exists set_attendees_updated_at on public.attendees;
create trigger set_attendees_updated_at
before update on public.attendees
for each row
execute function public.set_updated_at();

create or replace function public.prevent_attendee_email_change()
returns trigger
language plpgsql
as $$
begin
  if old.email is distinct from new.email
     and old.email is not null
     and old.email <> '' then
    raise exception 'attendee email is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_attendee_email_change_trigger on public.attendees;
create trigger prevent_attendee_email_change_trigger
before update of email on public.attendees
for each row
execute function public.prevent_attendee_email_change();

create or replace function public.mark_attendees_verified_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.is_anonymous, false) = true
     and coalesce(new.is_anonymous, false) = false then
    update public.attendees
    set is_verified = true,
        email = coalesce(email, new.email),
        updated_at = now()
    where auth_user_id = new.id;

    insert into public.audit_logs (
      actor_user_id,
      actor_role,
      action,
      target_type,
      target_id,
      reason,
      metadata
    )
    values (
      null,
      'attendee',
      'identity_verified',
      'auth_user',
      new.id::text,
      'Supabase anonymous user upgraded to verified email',
      jsonb_build_object('email', new.email)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists mark_attendees_verified_from_auth_trigger on auth.users;
create trigger mark_attendees_verified_from_auth_trigger
after update of is_anonymous, email on auth.users
for each row
execute function public.mark_attendees_verified_from_auth();

create or replace function public.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, nullif(new.email, ''), 'attendee')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;
