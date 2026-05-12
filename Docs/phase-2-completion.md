# Phase 2 Completion

## Status

Phase 2 is complete on the local development stack.

Completed on: 12 May 2026

## What We Built

- Added Phase 2 identity SQL in `supabase/sql/0003_phase2_identity.sql`.
- Added `attendees` with canonical `auth_user_id`, immutable email, alias, verification, check-in, and ledger fields.
- Added `pending_scans` for pre-verification scan capture.
- Added trigger behavior for anonymous-to-verified auth upgrades.
- Updated auth user sync to support anonymous Supabase users with no email.
- Updated backend JWT verification to support Supabase ES256/JWKS tokens.
- Added attendee backend routes:
  - `GET /attendees/me`
  - `POST /attendees/upsert`
  - `POST /attendees/update`
  - `POST /scan/presignup`
- Added event-day auto-check-in on authenticated attendee requests.
- Added `/[eventSlug]/join` with anonymous session startup and OTP request/verify UI.
- Added Phase 2 scripts:
  - `scripts/seed-attendees.ts`
  - `scripts/test-supabase-auth-flow.ts`
  - `scripts/test-24h-session.ts`
  - `scripts/test-checkin.ts`
  - `scripts/test-email-immutability.ts`
  - `scripts/test-anon-to-verified.ts`
  - `scripts/test-presignup-scan.ts`

## Supabase Setup Completed

- `0003_phase2_identity.sql` was applied successfully.
- Anonymous sign-ins were enabled in Supabase Auth.
- Phase 2 verified attendee seed data was created successfully.

## Tests Run

All automated Phase 2 checks passed:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm smoke` passed.
- `pnpm test:audit` passed.
- `pnpm test:rbac` passed.
- `pnpm seed:attendees` passed.
- `pnpm test:auth` passed.
- `pnpm test:session-24h` passed.
- `pnpm test:checkin` passed.
- `pnpm test:email-immutable` passed.
- `pnpm test:anon-to-verified` passed.
- `pnpm test:presignup` passed.
- `http://localhost:3000/sge-2026/join` returned 200.

## OTP Note

The OTP request path was verified against Supabase Auth. During the final rerun, Supabase returned its email send rate limit after earlier OTP attempts, so the script now treats that external rate limit as a non-failure once anonymous auth and attendee upsert have passed.

Manual verification still recommended once the rate limit clears:

1. Open `http://localhost:3000/sge-2026/join`.
2. Enter a real test email.
3. Confirm the OTP appears in Resend logs and arrives in the inbox.
4. Enter the OTP and verify the attendee becomes verified.

## Local Port Note

Port `8080` is occupied on this machine by `TNSLSNR`, so backend live tests used port `8081`.

The relevant test env overrides were:

```env
BACKEND_URL=http://localhost:8081/health
BACKEND_ADMIN_TEST_URL=http://localhost:8081/test/admin-only
```

The backend code still defaults to `8080` when that port is available.

## Gate Result

Phase 2 identity, anonymous entry, check-in, and pre-signup scan capture are ready to proceed to Phase 3.
