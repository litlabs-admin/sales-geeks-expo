create table if not exists public.access_overrides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  granted_until timestamptz not null,
  granted_by_user_id uuid not null references public.users(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists access_overrides_attendee_idx
  on public.access_overrides using btree (event_id, attendee_id, granted_until desc);

alter table public.access_overrides enable row level security;

do $$
begin
  create policy "access_overrides_own_select"
    on public.access_overrides
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.attendees a
        where a.id = access_overrides.attendee_id
          and a.auth_user_id = auth.uid()
      )
    );
exception
  when duplicate_object then null;
end $$;
