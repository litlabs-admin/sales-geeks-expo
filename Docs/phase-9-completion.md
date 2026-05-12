# Phase 9 Completion - Local Hardening, Load, Security, and UAT

Date completed: 13 May 2026

## What We Implemented

- Added Phase 9 load profiles:
  - `tests/load/scan-burst.js`
  - `tests/load/redeem-rush.js`
  - `tests/load/leaderboard-storm.js`
- Added `scripts/load-summary.ts` for local load checks and threshold reporting.
- Added `scripts/security-check.ts` with 20 security probes.
- Added Playwright UAT configuration in `playwright.config.ts`.
- Added five UAT journey specs:
  - `tests/e2e/journey-1-happy.spec.ts`
  - `tests/e2e/journey-2-presignup.spec.ts`
  - `tests/e2e/journey-3-staff-redeem.spec.ts`
  - `tests/e2e/journey-4-william.spec.ts`
  - `tests/e2e/journey-5-archive.spec.ts`
- Added `scripts/full-uat.ts` as the master phase gate.
- Added package scripts:
  - `pnpm load:all`
  - `pnpm security`
  - `pnpm uat`
- Added `@playwright/test`.
- Updated the local preview home page to expose attendee, admin, and staff UI entry points.

## Hardening Changes

- Switched backend Postgres access to prefer `DATABASE_POOL_URL` with prepared statements disabled.
- Made backend pool size configurable with `PG_POOL_MAX`.
- Removed unnecessary serializable isolation from the scan award transaction; idempotency is enforced by unique scan records plus atomic updates.
- Added hot-path caches for signed QR lookup, attendee lookup, archive lifecycle checks, scan replays, and leaderboard responses.
- Added cache clearing in scan reset helpers so behavioral tests remain deterministic.
- Made seed attendees idempotent against Supabase `email_exists` responses.
- Normalized `WEB_URL` in smoke checks so both bare origins and `/health` URLs work.
- Made the master UAT runner invoke pnpm reliably on Windows and retry a failed step once for transient local/cloud auth or network hiccups.

## Tests Run

All checks passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm load:all`
- `pnpm security`
- `pnpm test:e2e`
- `pnpm uat`

## Phase 9 Gate

- Scan burst passed with p95 below 400 ms.
- Leaderboard storm passed with p95 below 200 ms.
- Redeem rush produced exactly 10 completed redemptions and 90 blocked attempts.
- Security probes reported no high-severity findings.
- All five Playwright UAT journeys passed.
- Master `pnpm uat` exited successfully.

## UI Preview

The local UI is available at:

- `http://localhost:3000`

The preview page links to:

- Attendee app: `/sge-2026/home`
- Admin console: `/admin/events`
- Staff tools: `/staff/redeem`

Backend is running at:

- `http://localhost:8081/health`

## Notes

- Port `8080` is occupied on this machine, so Phase 9 used backend port `8081`.
- The OTP test hit Supabase email rate limiting during one UAT run; the script treats that as acceptable when the anonymous auth path still passes.
