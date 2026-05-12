# Phase 6 Completion - Rewards, Redemption + William Reconciliation

Date completed: 12 May 2026

## What We Implemented

- Added Phase 6 SQL migration `supabase/sql/0007_phase6_rewards.sql`.
- Added `rewards`, `redemption_records`, and `redemption_holds`.
- Added reward and redemption domain types in `@sgexpo/domain/rewards`.
- Added backend reward routes for:
  - `GET /rewards`
  - `POST /rewards/redeem`
  - `POST /staff/redeem`
  - `POST /admin/redemptions/:id/reverse`
  - `POST /rewards/william/claim`
  - `POST /webhooks/calendly/:eventSlug`
- Added serializable redemption transactions with inventory locking, spendable-balance checks, per-attendee limits, audit logs, and Redis idempotency keys.
- Added admin reversal that restores inventory and spendable balance and requires a reason.
- Added William premium reward flow:
  - Claim creates a hold and pending redemption.
  - Claim does not deduct points.
  - Signed Calendly webhook completes the redemption and deducts points.
  - Webhook replay is idempotent.
  - Reconciler test path completes a pending hold without a webhook.
- Added attendee rewards page, staff redemption page, rewards API proxy, and Calendly webhook proxy.
- Added Phase 6 seed and behavioral test scripts.

## Database Work

- Applied `supabase/sql/0007_phase6_rewards.sql`.
- Seeded 10 standard rewards and 1 William premium reward.
- Confirmed DB check constraints prevent negative reward inventory and negative attendee spendable balance.

## Tests Run

All checks passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm seed:rewards`
- `pnpm test:redeem`
- `pnpm test:redeem:oversell`
- `pnpm test:redeem:insufficient`
- `pnpm test:redeem:limit`
- `pnpm test:redeem:reverse`
- `pnpm test:william:claim`
- `pnpm test:william:webhook`
- `pnpm test:william:reconcile`
- `pnpm test:balance:nonneg`

## Phase 6 Gate

- Happy redemption moved balance and inventory together.
- 50 parallel redemption attempts on one inventory unit produced exactly one completed redemption.
- Insufficient balance failed before writes and left balance unchanged.
- Per-attendee redemption limit held under parallel load.
- Admin reversal restored inventory and balance and required a reason.
- William claim created a pending booking without deducting spendable balance.
- William webhook completed redemption and replay did not double-deduct.
- Reconciler completed a pending William hold.
- DB check constraint prevented spendable balance from going negative.

## Notes

- Local backend tests used `http://localhost:8081` because port `8080` is occupied on this machine.
- Rewards were reseeded after mutation-heavy tests to restore the clean Phase 6 fixture.
