# System Readiness Audit - Local Live-Event Readiness

Date: 13 May 2026

## Verdict

The system is not production-ready, even locally. The backend/domain layer contains many of the intended primitives, and localhost services are running, but the UI is mostly a preview shell rather than a usable live-event operations product. Critical workflows such as admin QR generation, business creation, exports, staff redemption, and ops monitoring are either not wired from the UI or require role-bearing tokens that the UI does not help the tester obtain.

## What Was Checked

- Product baseline: `deliverables.md`, `expo_details.md`, and `Docs/implementation-phases.md`.
- Current completion claim: `Docs/phase-9-completion.md`.
- Local services:
  - Web: `http://localhost:3000` returns 200.
  - Backend: `http://localhost:8081/health` returns `{"ok":true,"service":"backend","db_reachable":true}`.
  - Docker: only Redis is running from `infra/docker/docker-compose.yml`.
- Code paths for attendee, admin, staff, QR, exports, scan, leaderboard, rewards, Docker, and middleware.
- Local gates:
  - `pnpm typecheck` passed.
  - `pnpm test` passed, but mostly from cache and with no test files in `web`, `backend`, `worker`, or `contracts`.

## P0 Problems

### 1. Admin/staff/attendee are exposed together on the root page

Problem: `apps/web/app/page.tsx` shows Attendee App, Admin Console, and Staff Tools side by side as one local preview hub. This directly explains why all roles appear on the same page. It is useful for developers, but it is not an event app entry experience.

Impact: A real attendee sees admin/staff pathways, which breaks product clarity and undermines role separation. It also makes the app feel hard-coded and non-production.

Necessary solution:

- Replace `/` with an event-aware landing/redirect.
- Move the developer role switchboard to `/dev/preview` or guard it behind a local-only flag.
- Add clear role-specific routes:
  - attendee: `/{eventSlug}/home`
  - admin: `/admin`
  - staff: `/staff`
- Enforce route access in UI and backend, not just backend.

### 2. Admin QR generation UI is not functional

Problem: `apps/web/app/(admin)/admin/qr/page.tsx` renders a QR form, but the Create QR button is `type="button"` with no handler. The backend has `POST /admin/qr`, but the page never calls it.

Impact: QR generation cannot be validated by an operator from the UI. This blocks live-event setup and QR testing.

Necessary solution:

- Build a client/server action for QR creation.
- Fetch the current admin/staff session token.
- Submit to `/api/admin/qr` or directly to backend with the bearer token.
- Render the created QR URL, signed code, printable card, and error states.
- Add a QR list and bulk-print/download action.

### 3. Admin exports UI is not functional

Problem: `apps/web/app/(admin)/admin/exports/page.tsx` renders an export form, but the Export CSV button is `type="button"` with no handler. The proxy route `apps/web/app/api/exports/[type]/route.ts` requires a bearer token, but the UI never sends one.

Impact: Admin cannot export attendees, scans, sponsor leads, leaderboard, redemptions, notifications, or audit data from the UI.

Necessary solution:

- Wire export form submission.
- Include admin bearer token.
- Support all required export types from the PRD, not only attendees/scans/sponsor-leads.
- Show export status, `as_of` timestamp, download link, and failure messages.
- Add admin-only access guard.

### 4. Staff redemption UI is not functional

Problem: `apps/web/app/(staff)/staff/redeem/page.tsx` is a static form with a `type="button"` button and no backend call.

Impact: Staff cannot run a live desk redemption workflow from the app.

Necessary solution:

- Build staff attendee search by name, email, phone, alias, and profile QR.
- Show attendee balance, verification status, and eligible rewards.
- Submit redemption to backend with staff bearer token.
- Show success, blocked, insufficient balance, sold-out, and already-redeemed states.

### 5. Admin business creation UI is not functional

Problem: `apps/web/app/(admin)/admin/businesses/page.tsx` renders fields and a Create business button, but does not submit. Backend `POST /admin/businesses` exists and auto-generates an immutable signed business QR, but the UI does not use it.

Impact: Sponsor/business QR setup cannot be done from the admin console.

Necessary solution:

- Wire business creation/editing/listing.
- Show existing businesses and QR state.
- Expose generated QR link and print/download controls.

### 6. Attendee home has hard-coded progress

Problem: `apps/web/app/[eventSlug]/(attendee)/home/page.tsx` displays `Score 0`, `Rank pending`, and `Rewards unlock in Phase 6` as static text.

Impact: The page cannot represent a real attendee during a live event. It feels like a phase demo, not a product.

Necessary solution:

- Fetch attendee profile, score, spendable balance, rank, check-in state, verification state, and progress.
- Use live leaderboard/rewards data.
- Remove phase wording from user-facing UI.

### 7. Ops dashboard is a placeholder

Problem: `apps/web/app/(admin)/admin/ops/page.tsx` only shows event cards with placeholder copy: check-ins, scans, low stock, and audit widgets are not actually rendered.

Impact: Admin cannot monitor live-event health locally.

Necessary solution:

- Wire `/admin/ops` backend metrics into the page.
- Show live check-ins, OTP verification, scan volume, QR failures, low inventory, recent redemptions, sponsor interest, and export/job status.
- Add polling with manual refresh and partial-failure handling.

### 8. Auth/role testing path is incomplete in the UI

Problem: Backend routes correctly require bearer tokens and roles, but the admin/staff UI has no login/session path for role-bearing users. Supabase JWT role is read from `app_role`, but no UI exists to sign in as admin/staff and no local role switcher or seeded test credentials are presented.

Impact: Backend functionality may exist, but operators cannot exercise it locally through the browser.

Necessary solution:

- Add admin/staff login screen and session state.
- Provide seeded local admin/staff users or a documented local token workflow.
- Hide/guard admin/staff pages when not authorized.
- Add visible current-role indicator for local UAT.

## P1 Problems

### 9. Docker is underused

Problem: `infra/docker/docker-compose.yml` only runs Redis. The implementation plan requires local Postgres, Redis/Valkey, and optional email preview. The current app depends on external Supabase/Postgres configuration instead of a complete local stack.

Impact: Local production-readiness cannot be verified reliably or offline. New developers cannot run a full deterministic environment from Docker.

Necessary solution:

- Add local Postgres or Supabase stack to Docker Compose.
- Add migrations and seed commands that run against the local container DB.
- Add optional local email preview or documented sandbox email path.
- Add a single `pnpm dev` or `pnpm local:up` command that starts Redis, DB, backend, worker, and web.

### 10. Runtime defaults are inconsistent

Problem: `.env.example` defaults backend URLs to port 8080, while this machine is using 8081. The code falls back to `http://localhost:8080` in multiple places.

Impact: Local functionality breaks silently when 8080 is occupied or when `.env.local` is missing.

Necessary solution:

- Standardize local ports.
- Put backend URL resolution in one shared helper.
- Fail with clear setup guidance when backend is unreachable.

### 11. Middleware/favicon behavior is noisy

Problem: Logs show requests such as `/favicon.ico/home` causing backend content fetch failures. Middleware ignores `/favicon.ico`, but relative favicon/navigation behavior still leaks into event routes.

Impact: Noisy 500s make local debugging harder and can contribute to perceived slowness.

Necessary solution:

- Add a real favicon/static metadata path.
- Ensure attendee route links and redirects cannot append to `/favicon.ico`.
- Add friendly error boundaries for failed content fetches.

### 12. Backend error handling leaks raw failures

Problem: Backend logs show raw Postgres UUID syntax errors for invalid query input during security probes.

Impact: The backend resists SQL injection because queries are parameterized, but input validation should reject invalid UUIDs before Postgres raises noisy errors.

Necessary solution:

- Validate UUID query params before DB calls.
- Return controlled 400 errors.
- Add request IDs and structured logs.

### 13. Tests do not prove UI readiness

Problem: `pnpm test` passes, but `web`, `backend`, `worker`, and `contracts` have no local unit tests. Many claims in `Docs/phase-9-completion.md` are not supported by current UI wiring.

Impact: Cached green tests can mask broken user-facing functionality.

Necessary solution:

- Add web tests for admin QR, exports, business creation, staff redemption, attendee home, rewards, leaderboard, and scan flows.
- Add backend integration tests for protected routes.
- Run e2e tests against a freshly seeded local environment, not only cached output.

## P2 Problems

### 14. UI does not yet feel like a live-event product

Problem: Several pages use simple cards and placeholders. The app lacks a focused live-event scenario view with current attendee state, scan feedback, operational admin state, and staff queue-style workflows.

Impact: It is hard to rehearse the actual event day.

Necessary solution:

- Build a local UAT scenario mode with seeded attendees, sponsors, QR codes, rewards, and roles.
- Add guided live-event panels:
  - attendee scan and reward journey
  - staff search/redeem journey
  - admin create QR/export/ops journey
- Keep the design simple, mobile-first, and role-specific.

### 15. Completion docs are ahead of reality

Problem: `Docs/phase-9-completion.md` says all checks passed and the local preview exposes role entry points, but the entry points do not exercise the real workflows.

Impact: Project status is misleading.

Necessary solution:

- Mark current status as local prototype/backbone, not production-ready.
- Update completion evidence only after browser-based UAT confirms each workflow from the UI.

## Recommended Fix Order

1. Create a proper local runbook and Docker stack: DB, Redis, backend, worker, web, seed data.
2. Add local seeded admin/staff/attendee auth flows or a safe dev-only role switcher.
3. Move the root role switchboard to a dev-only route and make `/` attendee/event focused.
4. Wire admin business creation and QR generation end to end.
5. Wire export downloads end to end.
6. Wire staff attendee search and redemption end to end.
7. Replace attendee hard-coded progress with live score/rank/rewards data.
8. Replace ops dashboard placeholder with real metrics.
9. Add UI/e2e tests that run against a clean local seed.
10. Re-run typecheck, tests, smoke, security, and e2e from a clean non-cached state.

## Local Readiness Checklist Before Calling It Production-Ready Locally

- `pnpm local:up` starts Docker services, backend, worker, and web.
- `pnpm db:reset && pnpm db:seed` creates a complete SGE 2026 scenario.
- Attendee can join, scan a QR, see points/rank update, view rewards, and redeem.
- Admin can create/edit event content, create businesses, generate/print QRs, send notifications, view ops, and export data.
- Staff can search attendees, inspect eligibility, and redeem rewards.
- QR duplicate scans are idempotent through the UI.
- Sponsor interest and consent exports work through the UI.
- William reward can be rehearsed with a local/simulated webhook.
- Archive transition and 10-day access can be demonstrated.
- All role pages are guarded and no attendee sees admin/staff UI.
- No server/client console P0 errors during the full live-event rehearsal.
