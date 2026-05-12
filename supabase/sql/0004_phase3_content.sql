create table if not exists public.geeks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  photo_url text,
  bio text not null default '',
  contact_email text,
  calendly_url text,
  is_william boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  tier text not null,
  logo_url text,
  page_html text not null default '',
  lead_capture_enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text not null default '',
  stage text not null default 'Main Stage',
  category text not null default 'General',
  type text not null default 'session',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  speaker_id uuid references public.geeks(id) on delete set null,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_sessions_time_order check (ends_at > starts_at)
);

create table if not exists public.sponsor_interest (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  consented boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  undone_at timestamptz,
  constraint sponsor_interest_unique unique (event_id, attendee_id, sponsor_id)
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  body text not null,
  posted_at timestamptz not null default now(),
  posted_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agenda_sessions_event_time_idx
  on public.agenda_sessions using btree (event_id, starts_at);
create index if not exists geeks_event_sort_idx
  on public.geeks using btree (event_id, sort_order, name);
create index if not exists sponsors_event_sort_idx
  on public.sponsors using btree (event_id, sort_order, name);
create index if not exists sponsor_interest_attendee_idx
  on public.sponsor_interest using btree (event_id, attendee_id);
create index if not exists faqs_event_sort_idx
  on public.faqs using btree (event_id, sort_order);
create index if not exists announcements_event_posted_idx
  on public.announcements using btree (event_id, posted_at desc);

alter table public.agenda_sessions enable row level security;
alter table public.geeks enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_interest enable row level security;
alter table public.faqs enable row level security;
alter table public.announcements enable row level security;

do $$
begin
  create policy "agenda_sessions_public_select"
    on public.agenda_sessions for select to anon, authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "geeks_public_select"
    on public.geeks for select to anon, authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "sponsors_public_select"
    on public.sponsors for select to anon, authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "faqs_public_select"
    on public.faqs for select to anon, authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "announcements_public_select"
    on public.announcements for select to anon, authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "sponsor_interest_select_own"
    on public.sponsor_interest
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.attendees attendee
        where attendee.id = sponsor_interest.attendee_id
          and attendee.auth_user_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

drop trigger if exists set_geeks_updated_at on public.geeks;
create trigger set_geeks_updated_at before update on public.geeks
for each row execute function public.set_updated_at();

drop trigger if exists set_sponsors_updated_at on public.sponsors;
create trigger set_sponsors_updated_at before update on public.sponsors
for each row execute function public.set_updated_at();

drop trigger if exists set_agenda_sessions_updated_at on public.agenda_sessions;
create trigger set_agenda_sessions_updated_at before update on public.agenda_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_sponsor_interest_updated_at on public.sponsor_interest;
create trigger set_sponsor_interest_updated_at before update on public.sponsor_interest
for each row execute function public.set_updated_at();

drop trigger if exists set_faqs_updated_at on public.faqs;
create trigger set_faqs_updated_at before update on public.faqs
for each row execute function public.set_updated_at();
