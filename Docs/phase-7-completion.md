# Phase 7 Completion - Notifications + Ops Dashboard

Date completed: 12 May 2026

## What We Implemented

- Added Phase 7 SQL migration `supabase/sql/0008_phase7_notifications_ops.sql`.
- Added `notifications` and `notification_recipients`.
- Added ops views:
  - `vw_ops_checkins`
  - `vw_ops_scans_per_minute`
  - `vw_ops_low_stock`
  - `vw_ops_recent_audit`
- Added notification domain helpers in `@sgexpo/domain/notifications`.
- Added backend notification routes for:
  - `POST /admin/notifications`
  - `POST /admin/notifications/due`
  - `GET /notifications/feed`
  - `POST /notifications/:id/read`
  - `GET /admin/ops`
- Added a small worker app with notification fanout, due polling, and William reconciliation job stubs.
- Added admin notification and ops pages.
- Added attendee notification feed API proxy.
- Added Phase 7 behavioral test scripts.

## Database Work

- Applied `supabase/sql/0008_phase7_notifications_ops.sql`.
- Confirmed every notification records `created_by_user_id`.
- Confirmed notification recipients are materialized per attendee.

## Tests Run

All checks passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm test:broadcast`
- `pnpm test:scheduled`
- `pnpm test:notif-feed`
- `pnpm test:ops`
- `pnpm test:ops:degrade`

## Phase 7 Gate

- Broadcast reached every attendee.
- Scheduled notification stayed pending until due processing and then delivered.
- Feed API returned notifications and persisted `read_at`.
- Ops dashboard check-in counts matched underlying seeded data.
- Dropping one ops view returned HTTP 200 with that widget marked `unavailable` while other widgets still returned normally.

## Notes

- Local backend tests used `http://localhost:8081` because port `8080` is occupied on this machine.
- The worker package exists and can be started with `pnpm dev:worker`; tests used the backend due-processing route for deterministic, fast scheduled delivery checks.
