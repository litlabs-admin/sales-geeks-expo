# Phase 5 Completion - Scoring Engine + Leaderboard

Date completed: 12 May 2026

## What We Implemented

- Added Phase 5 SQL migration `supabase/sql/0006_phase5_scoring_leaderboard.sql`.
- Added `scan_records` with a unique `(attendee_id, qr_code_id)` constraint.
- Added leaderboard index on attendees.
- Extended QR types with `sponsor`, `session`, and `hidden_bonus`.
- Added server-side scan awarding with:
  - HMAC validation before QR lookup.
  - Redis idempotency key per attendee/QR.
  - DB uniqueness as the second idempotency layer.
  - Redis scan rate limit of 10 scans per attendee per minute.
  - Hidden-bonus reveal and expiry checks.
  - Separate competition-score and spendable-balance updates.
  - Audit log write for awarded scans.
- Added pending-scan replay after attendee upsert.
- Added leaderboard API returning aliases only, top 10, and own rank.
- Added scan landing page, scan API proxy, and live leaderboard page.
- Added Phase 5 seed and behavioral test scripts.

## Database Work

- Applied `supabase/sql/0006_phase5_scoring_leaderboard.sql`.
- Seeded the Phase 5 QR mix:
  - 6 sponsor QRs.
  - 4 session QRs.
  - 3 hidden-bonus QRs.
  - 1 inactive QR.

## Tests Run

All checks passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm seed:qrs`
- `pnpm test:scan:idempotent`
- `pnpm test:scan:redis-bypass`
- `pnpm test:scan:ratelimit`
- `pnpm test:scan:hidden`
- `pnpm test:leaderboard`
- `pnpm test:tiebreak`
- `pnpm test:leaderboard:anon`
- `pnpm test:scan:presignup-replay`

## Phase 5 Gate

- 100 parallel scans produced exactly one award.
- DB uniqueness prevented double-credit when Redis idempotency was bypassed.
- The 11th different scan inside one minute returned `429`.
- Hidden-bonus QRs returned `not_yet_active` before reveal and awarded after reveal.
- Leaderboard API returned aliases and scores only.
- Tie-break ordering uses earliest timestamp reaching the current score.
- Pre-signup pending scans replay after attendee upsert.

## Notes

- Local backend tests used `http://localhost:8081` because port `8080` is occupied on this machine.
- The first idempotency run collided with a concurrently running Redis-bypass test against the same seeded attendee; it was rerun sequentially and passed.
- The QR fixture was reseeded after tests to restore the hidden-bonus reveal windows.
