# Phase 0 Completion

## Status

Phase 0 is complete on the local development stack.

Completed on: 12 May 2026

## What We Built

- Created the pnpm + Turborepo monorepo scaffold.
- Added the Next.js 14 attendee web app in `apps/web`.
- Added the Hono backend in `apps/backend`.
- Added shared domain logic in `packages/domain`.
- Added shared contracts and placeholder Supabase types in `packages/contracts`.
- Added Phase 0 Supabase SQL files:
  - `supabase/sql/0000_extensions.sql`
  - `supabase/sql/0001_phase0_foundation.sql`
- Added local Redis via `infra/docker/docker-compose.yml`.
- Added `.env.example` and local `.env.local` setup.
- Added Phase 0 scripts:
  - `scripts/seed-base.ts`
  - `scripts/smoke.ts`
  - `scripts/test-audit.ts`
  - `scripts/test-rbac.ts`
  - `scripts/db-truncate.ts`
  - `scripts/gen-types.sh`
- Added CI workflow for typecheck, lint, and tests.

## Supabase Setup Completed

- `0000_extensions.sql` was applied successfully.
- `0001_phase0_foundation.sql` was applied successfully.
- Base seed data was inserted successfully:
  - Event: `sge-2026`
  - Dev admin user
  - Dev staff user

## Tests Run

All Phase 0 checks that can be run locally at this stage passed:

- `pnpm redis:up` passed.
- `pnpm db:seed` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm test:audit` passed.
- `pnpm smoke` passed.
- `pnpm test:rbac` passed.
- Supabase anon read from `events_public` passed.

## Local Port Note

The implementation plan expects the backend on port `8080`, but this machine already has a local `TNSLSNR` process listening on `8080`.

For Phase 0 live endpoint testing, the backend was run on port `8081` and the test scripts were pointed at:

```env
BACKEND_URL=http://localhost:8081/health
BACKEND_ADMIN_TEST_URL=http://localhost:8081/test/admin-only
```

This is a local machine conflict only. The backend code still defaults to port `8080` when that port is available.

## Gate Result

Phase 0 foundation is ready to proceed to Phase 1.
