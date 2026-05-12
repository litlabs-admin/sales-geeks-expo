create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  body text not null,
  audience jsonb not null default '{"type":"all"}'::jsonb,
  scheduled_at timestamptz,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  unique (notification_id, attendee_id)
);

create index if not exists notifications_event_due_idx
  on public.notifications using btree (event_id, scheduled_at, delivered_at);

create index if not exists notification_recipients_attendee_idx
  on public.notification_recipients using btree (attendee_id, delivered_at desc);

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

do $$
begin
  create policy "notifications_read_authenticated"
    on public.notifications
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "notification_recipients_own_select"
    on public.notification_recipients
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.attendees a
        where a.id = notification_recipients.attendee_id
          and a.auth_user_id = auth.uid()
      )
    );
exception
  when duplicate_object then null;
end $$;

create or replace view public.vw_ops_checkins as
select
  event_id,
  count(*)::int as total_attendees,
  count(*) filter (where checked_in_at is not null)::int as checked_in,
  max(checked_in_at) as last_checkin_at
from public.attendees
group by event_id;

create or replace view public.vw_ops_scans_per_minute as
select
  event_id,
  date_trunc('minute', awarded_at) as minute,
  count(*)::int as scans
from public.scan_records
where awarded_at >= now() - interval '60 minutes'
group by event_id, date_trunc('minute', awarded_at);

create or replace view public.vw_ops_low_stock as
select
  event_id,
  id as reward_id,
  name,
  inventory
from public.rewards
where inventory <= 2
order by inventory asc, name asc;

create or replace view public.vw_ops_recent_audit as
select
  id,
  actor_user_id,
  actor_role,
  action,
  target_type,
  target_id,
  created_at
from public.audit_logs
order by created_at desc
limit 20;

grant select on public.vw_ops_checkins to anon, authenticated;
grant select on public.vw_ops_scans_per_minute to anon, authenticated;
grant select on public.vw_ops_low_stock to anon, authenticated;
grant select on public.vw_ops_recent_audit to anon, authenticated;
