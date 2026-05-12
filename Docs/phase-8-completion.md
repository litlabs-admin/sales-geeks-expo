# Phase 8 Completion - Reporting, Exports, and Archive

Date completed: 12 May 2026

## What We Implemented

- Added Phase 8 SQL migration `supabase/sql/0009_phase8_exports_archive.sql`.
- Added `access_overrides` for admin-controlled archive access extensions.
- Added private Supabase storage bucket configuration for `exports`.
- Added export helpers in `@sgexpo/domain/exports`.
- Added archive-window helpers in `@sgexpo/domain/archive`.
- Added backend CSV export support for:
  - `attendees`
  - `scans`
  - `sponsor-leads`
- Added export audit logging with an `as_of` timestamp and `x-export-as-of` response header.
- Added sponsor lead export filtering so only explicit, active consent is exported.
- Added archive mutation guards for attendee write paths including scans, rewards, William claims, and sponsor interest actions.
- Added attendee archive access enforcement for the 10-day post-event window.
- Added admin access override route:
  - `POST /admin/access-overrides`
- Added admin export route:
  - `GET /admin/exports/:type`
- Added Next.js export proxy:
  - `apps/web/app/api/exports/[type]/route.ts`
- Added admin exports page:
  - `apps/web/app/(admin)/admin/exports/page.tsx`
- Added worker archive transition job support.
- Added Phase 8 behavioral test scripts.
- Updated the test Redis helper to create Redis connections lazily, so importing older helpers does not keep Phase 8 scripts alive after completion.

## Database Work

- Applied `supabase/sql/0009_phase8_exports_archive.sql`.
- Confirmed `access_overrides` can extend attendee archive access beyond the default post-event window.
- Confirmed export audit rows are written to `audit_logs`.

## Tests Run

All checks passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm test:export:attendees`
- `pnpm test:export:realtime`
- `pnpm test:export:consent`
- `pnpm test:archive`
- `pnpm test:archive:expiry`
- `pnpm test:archive:reopen`
- `pnpm test:archive:leaderboard-auth`

## Phase 8 Gate

- Attendee export returned the expected rows and required columns.
- Scan export reflected newly written scan activity.
- Sponsor lead export included only attendees with active sponsor consent and excluded undone interest.
- Archive mode blocked attendee scans and reward redemptions.
- Admin mutations remained allowed in archive mode.
- Attendee archive access remained open within 10 days of event end.
- Attendee archive access closed after the 10-day window.
- Admin access override reopened one attendee without reopening everyone.
- Final leaderboard required authentication during archive mode.

## Notes

- Local backend tests used `http://localhost:8081` because port `8080` is occupied on this machine.
- CSV exports are generated directly by the backend for the current local build. The export shape and audit behavior are now covered; large-file queueing can be hardened later if needed for production-scale datasets.
