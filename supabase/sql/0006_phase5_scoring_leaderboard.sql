alter type public.qr_code_type add value if not exists 'sponsor';
alter type public.qr_code_type add value if not exists 'session';
alter type public.qr_code_type add value if not exists 'hidden_bonus';

create table if not exists public.scan_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  points_competition integer not null default 0,
  points_spendable integer not null default 0,
  awarded_at timestamptz not null default now(),
  constraint scan_records_attendee_qr_unique unique (attendee_id, qr_code_id)
);

create index if not exists scan_records_event_attendee_idx
  on public.scan_records using btree (event_id, attendee_id, awarded_at desc);

create index if not exists attendees_leaderboard_idx
  on public.attendees using btree (
    event_id,
    competition_score desc,
    reached_current_score_at asc,
    id asc
  );

alter table public.scan_records enable row level security;

do $$
begin
  create policy "scan_records_own_select"
    on public.scan_records
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.attendees a
        where a.id = scan_records.attendee_id
          and a.auth_user_id = auth.uid()
      )
    );
exception
  when duplicate_object then null;
end $$;
