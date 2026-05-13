alter type public.qr_code_type add value if not exists 'workshop';
alter type public.qr_code_type add value if not exists 'vip';
alter type public.qr_code_type add value if not exists 'networking';

alter table public.businesses
  add column if not exists sponsor_tier text,
  add column if not exists website_url text,
  add column if not exists archived_at timestamptz;

alter table public.qr_codes
  add column if not exists campaign_name text,
  add column if not exists status text not null default 'active',
  add column if not exists max_scans integer,
  add column if not exists cooldown_seconds integer,
  add column if not exists approved_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists sponsor_id uuid references public.sponsors(id) on delete set null,
  add column if not exists session_id uuid references public.agenda_sessions(id) on delete set null,
  add column if not exists usage_rules jsonb not null default '{}'::jsonb;

update public.qr_codes
set campaign_name = coalesce(campaign_name, reason, type::text || ' QR')
where campaign_name is null;

update public.qr_codes
set status = case when active then 'active' else 'disabled' end
where status is null or status = '';

alter table public.qr_codes
  drop constraint if exists qr_codes_status_check,
  add constraint qr_codes_status_check check (status in ('draft', 'pending_approval', 'approved', 'active', 'disabled', 'expired'));

alter table public.qr_codes
  drop constraint if exists qr_codes_max_scans_check,
  add constraint qr_codes_max_scans_check check (max_scans is null or max_scans > 0);

alter table public.qr_codes
  drop constraint if exists qr_codes_cooldown_check,
  add constraint qr_codes_cooldown_check check (cooldown_seconds is null or cooldown_seconds >= 0);

create index if not exists businesses_event_archived_idx
  on public.businesses using btree (event_id, archived_at, name);

create index if not exists qr_codes_event_status_idx
  on public.qr_codes using btree (event_id, status, active, created_at desc);

create index if not exists qr_codes_created_by_idx
  on public.qr_codes using btree (created_by_user_id, created_at desc);

create or replace view public.vw_ops_qr_activity as
select
  q.event_id,
  q.id as qr_code_id,
  q.campaign_name,
  q.type,
  q.status,
  q.active,
  count(sr.id)::int as total_scans,
  count(distinct sr.attendee_id)::int as unique_attendees,
  max(sr.awarded_at) as last_scan_at
from public.qr_codes q
left join public.scan_records sr on sr.qr_code_id = q.id
group by q.event_id, q.id, q.campaign_name, q.type, q.status, q.active;

grant select on public.vw_ops_qr_activity to anon, authenticated;
