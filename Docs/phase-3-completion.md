# Phase 3 Completion

## Status

Phase 3 is complete on the local development stack.

Completed on: 12 May 2026

## What We Built

- Added Phase 3 content SQL in `supabase/sql/0004_phase3_content.sql`.
- Added content tables:
  - `agenda_sessions`
  - `geeks`
  - `sponsors`
  - `sponsor_interest`
  - `faqs`
  - `announcements`
- Added attendee routes under `/:eventSlug`:
  - `/home`
  - `/agenda`
  - `/geeks`
  - `/rewards`
  - `/leaderboard`
  - `/sponsors`
  - `/sponsor/:id`
  - `/faqs`
  - `/profile`
  - `/terms`
- Added five-tab attendee navigation: Home, Agenda, Geeks, Rewards, Leaderboard.
- Added server-computed agenda live status.
- Added sponsor interest, separate consent, and undo backend routes.
- Added announcement creation and polling routes.
- Added Fuse-powered FAQ search.
- Added Phase 3 seed and test scripts:
  - `scripts/seed-content.ts`
  - `scripts/test-agenda-status.ts`
  - `scripts/test-sponsor-interest.ts`
  - `scripts/test-faq-search.ts`
  - `scripts/test-announcement-poll.ts`
  - `scripts/test-five-tab-nav.ts`

## Supabase Setup Completed

- `0004_phase3_content.sql` was applied successfully.
- Phase 3 content seed data was created successfully:
  - 8 agenda sessions
  - 4 Geeks, including William
  - 6 sponsors
  - 12 FAQs
  - 1 base announcement

## Tests Run

All automated Phase 3 checks passed:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm smoke` passed.
- `pnpm seed:content` passed.
- `pnpm test:agenda` passed.
- `pnpm test:sponsor-interest` passed.
- `pnpm test:faq` passed.
- `pnpm test:announcements` passed.
- `pnpm test:five-tabs` passed.

## Product Rules Verified

- Five-tab attendee navigation has exactly five items in the correct order.
- Agenda status resolves to `ended`, `live`, and `upcoming` from server-side time logic.
- Sponsor interest creates an interest row without consent.
- Sponsor consent is captured as a separate action.
- Sponsor interest can be undone.
- Sponsor interest and consent do not change `competition_score`.
- FAQ search ranks the matching result first.
- Announcements created by admin are returned through the attendee polling route.

## Local Port Note

Port `8080` is occupied on this machine by `TNSLSNR`, so backend live tests used port `8081`.

For this workspace, `.env.local` was updated to:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8081
BACKEND_URL=http://localhost:8081/health
```

The backend code still defaults to `8080` when that port is available.

## Gate Result

Phase 3 public content, attendee navigation, sponsor interest, FAQs, and announcements are ready to proceed to Phase 4.
