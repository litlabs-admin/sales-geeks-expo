# Phase 1 Completion

## Status

Phase 1 is complete on the local development stack.

Completed on: 12 May 2026

## What We Built

- Added multi-event schema support with `supabase/sql/0002_phase1_multi_event.sql`.
- Extended `events` with:
  - `lifecycle_state`
  - `brand_tokens`
  - `feature_flags`
- Updated `events_public` for browser-safe event reads.
- Added dynamic event slug routing with `apps/web/middleware.ts`.
- Replaced the hardcoded `/sge-2026` route with `apps/web/app/[eventSlug]`.
- Added layout-level brand CSS variables from event `brand_tokens`.
- Added minimal admin event list/detail pages.
- Added lifecycle domain logic in `packages/domain/src/event-lifecycle.ts`.
- Added event-scoping helper in `packages/domain/src/event-scope.ts`.
- Added backend admin event endpoints:
  - `GET /admin/events`
  - `POST /admin/events/:id/transition`
- Added Phase 1 scripts:
  - `scripts/seed-events.ts`
  - `scripts/test-event-isolation.ts`
  - `scripts/test-lifecycle.ts`
  - `scripts/test-branding.ts`
  - `scripts/test-slug-404.ts`

## Supabase Setup Completed

- `0002_phase1_multi_event.sql` was applied successfully.
- Phase 1 seed data was inserted successfully:
  - `sge-2026`
  - `sge-2027`

## Tests Run

All Phase 0 and Phase 1 checks passed:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm smoke` passed.
- `pnpm test:audit` passed.
- `pnpm test:rbac` passed.
- `pnpm seed:events` passed.
- `pnpm test:isolation` passed.
- `pnpm test:lifecycle` passed.
- `pnpm test:branding` passed.
- `pnpm test:slug` passed.

## Local Port Note

Port `8080` is still occupied on this machine by `TNSLSNR`, so the backend was run on port `8081` for live endpoint tests.

The relevant test env overrides were:

```env
BACKEND_URL=http://localhost:8081/health
BACKEND_ADMIN_TEST_URL=http://localhost:8081/test/admin-only
```

The backend code still defaults to `8080` when that port is available.

## Gate Result

Phase 1 multi-event core is ready to proceed to Phase 2.
