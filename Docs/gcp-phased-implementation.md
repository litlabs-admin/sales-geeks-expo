# SalesGeek Scotland — Local-First Phased Implementation Plan
## Scottish Growth Expo 2026 — Event Companion Web App

> **Important:** This document is **local-only**. We are not deploying anywhere until the entire app runs end-to-end on a developer laptop and every phase test gate is green. Deployment (GCP, scaling, infra) is **deferred** and will be planned in a separate document once local is fully working.

> **Why local-first?** It's cheaper, faster to iterate on, and you never debug "is this a deployment problem or a code problem" mid-event. Once everything works locally, taking it to GCP is mechanical.

> **Sources of truth for scope:** [northstar.md](../northstar.md), [docs/read.md](../read.md), [deliverables.md](../deliverables.md).

---

## How this document is organized

1. **Part 1 — Local setup.** Everything you need on your laptop. One-time install. Run once and forget.
2. **Part 2 — The phased build.** Phases 0 through 9. Each phase has the same shape:
   - **What we're building** (plain English)
   - **Files & DB tables** involved
   - **How to build it** (step-by-step)
   - **Scripts to create** (concrete shell/TS scripts you write and check in)
   - **How to test it** (commands to run)
   - **Test gate** (must pass before next phase opens)
   - **Non-negotiables** (rules that don't bend under deadline)
3. **Part 3 — Deployment (deferred).** A placeholder. We come back to this only after Phase 9.

---

# Part 1 — Local setup

## 1.1 What you need on your laptop

Install these once. If you already have them, skip.

| Tool | Version | Why |
|---|---|---|
| Node.js | 20.x LTS | Runs Next.js and the worker |
| pnpm | 9.x | Package manager (faster than npm, monorepo-friendly) |
| Docker Desktop or OrbStack | latest | Runs Postgres, Redis, MailHog locally |
| Git | any recent | Source control |
| `psql` client | 15.x | Poke the database directly when debugging |
| A code editor | VS Code / Cursor / similar | Day-to-day work |

Install on macOS:

```bash
# Node + pnpm
brew install node@20
npm install -g pnpm

# Postgres client
brew install libpq && brew link --force libpq

# OrbStack (lighter than Docker Desktop)
brew install --cask orbstack
```

That's it. Everything else runs in Docker.

## 1.2 What runs locally

```
┌─────────────────────────────────────────────────────────┐
│  Your laptop                                            │
│                                                         │
│   pnpm dev (Next.js on http://localhost:3000)           │
│   pnpm dev:worker (background jobs)                     │
│                                                         │
│   ┌──────────────────────────────────────────────────┐  │
│   │  Docker Compose                                  │  │
│   │   - postgres   :5432  (the database)             │  │
│   │   - redis      :6379  (cache + rate limit)       │  │
│   │   - mailhog    :8025  (fake email inbox in web)  │  │
│   └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **MailHog** is a fake SMTP server with a web UI on `http://localhost:8025`. Every email the app "sends" (OTPs, magic links) appears there. No real emails go out locally. No Resend account needed for local development.
- No GCP, no cloud, no internet dependency for the core loop.

## 1.3 One-time bootstrap

This is **Phase 0** below in concrete terms. Once it works, you have a green-field repo and you start building features.

```bash
# 1. clone & install
git clone <repo-url> sales-geek-expo
cd sales-geek-expo
pnpm install

# 2. start the local services (Postgres, Redis, MailHog)
docker compose -f infra/docker/docker-compose.yml up -d

# 3. copy env template
cp .env.example .env.local

# 4. run migrations and seed
pnpm db:reset
pnpm db:seed

# 5. start the app and worker in two terminals
pnpm dev          # terminal 1
pnpm dev:worker   # terminal 2

# 6. open the app
open http://localhost:3000/sge-2026
# open the fake email inbox in another tab
open http://localhost:8025
```

If those commands work, your laptop is ready and you can move to Phase 1.

## 1.4 The pnpm scripts you'll live in

These go in the root `package.json`. Build them as part of Phase 0 — every later phase adds more scripts.

```json
{
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "dev:worker": "turbo run dev --filter=worker",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:up": "docker compose -f infra/docker/docker-compose.yml up -d",
    "db:down": "docker compose -f infra/docker/docker-compose.yml down",
    "db:reset": "tsx scripts/db-reset.ts",
    "db:seed": "tsx scripts/seed-base.ts",
    "db:psql": "psql postgres://salesgeek:salesgeek@localhost:5432/salesgeek",
    "smoke": "tsx scripts/smoke.ts"
  }
}
```

The exact list grows phase by phase. The point: every test, every reset, every check is a named script. You should never have to remember a long curl command.

---

# Part 2 — The phased build

> **Rule of the road:** A phase is closed only when:
> 1. All listed P0 test cases pass on your laptop.
> 2. `pnpm test && pnpm typecheck && pnpm lint` is green.
> 3. The phase's smoke script (each phase ships one) returns exit code 0.
> 4. Non-negotiables are visibly enforced (you wrote a test that proves it).

---

## Phase 0 — Foundation (Day 1, 12 May)

### What we're building
The empty house. A monorepo that boots, has a database, runs migrations, has audit-logged service patterns, and runs `/health` returning 200. No features yet.

### Files & DB tables
- Files:
  - `apps/web/` — Next.js 14 App Router scaffold
  - `apps/worker/` — small Node service for background jobs
  - `packages/domain/` — domain logic (we build into this every phase)
  - `packages/db/` — Prisma schema + client
  - `packages/contracts/` — Zod schemas, shared types
  - `infra/docker/docker-compose.yml` — Postgres, Redis, MailHog
  - `.env.example` — template for env vars
- DB tables (just enough to test the plumbing):
  - `events` (id, slug, name, lifecycle_state, starts_at, ends_at, brand_tokens jsonb)
  - `users` (id, type, email, created_at)
  - `audit_logs` (id, actor_id, actor_type, action, target_type, target_id, reason, payload jsonb, created_at)

### How to build it (step-by-step)
1. **Scaffold the monorepo.** Use pnpm workspaces + Turborepo. Root `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
2. **Create the Next.js app.** `pnpm create next-app@14 apps/web --typescript --app --tailwind --eslint`. Strip the demo content.
3. **Create the worker app.** A small `apps/worker/src/index.ts` that exposes `POST /jobs/:name` (we use it in Phase 7).
4. **Create the Prisma package.** `packages/db/prisma/schema.prisma` with the three tables above. Generate client into `node_modules/@prisma/client`.
5. **Set up the audit pattern.** In `packages/domain/audit.ts`, export a function `withAudit(tx, actor, action, target, reason, fn)` that wraps a Prisma transaction and writes an `audit_logs` row inside the same `$transaction`. Every mutation in later phases uses this wrapper.
6. **Set up RBAC.** In `packages/domain/rbac.ts`, export `canDoAction(actor, action, resource)` and a tRPC middleware `requireRole(role)`.
7. **Add the `/health` route.** `apps/web/app/health/route.ts` returning `{ ok: true, version: process.env.GIT_SHA ?? 'dev' }`.
8. **Add Docker Compose.** Three services as in Part 1.
9. **Add CI.** `.github/workflows/ci.yml` runs `pnpm typecheck && pnpm lint && pnpm test`. (CI runs on every push — that's a tool to keep us honest, not a deployment.)

### Scripts to create
Create each of these as a real file. Numbers refer to file paths.

1. **[scripts/db-reset.ts](../scripts/db-reset.ts)** — drops the DB, recreates it, runs migrations.
   ```ts
   // What it does:
   //   1. docker compose exec postgres dropdb -U salesgeek salesgeek --if-exists
   //   2. docker compose exec postgres createdb -U salesgeek salesgeek
   //   3. pnpm --filter db prisma migrate deploy
   //   4. logs "DB ready"
   ```
2. **[scripts/seed-base.ts](../scripts/seed-base.ts)** — minimum seed: one event (`sge-2026`), one admin user, one staff user.
3. **[scripts/smoke.ts](../scripts/smoke.ts)** — pings `http://localhost:3000/health`, asserts 200, exits 0/1. This is the first time we have a single command that says "is the app up?".
4. **[scripts/test-audit.ts](../scripts/test-audit.ts)** — runs a `withAudit` call, then queries `audit_logs`, asserts one row exists with the right action and actor. Also runs the same call but throws inside, asserts no row is left behind (transactional).
5. **[scripts/test-rbac.ts](../scripts/test-rbac.ts)** — calls `canDoAction` with a staff actor and an admin-only action, asserts false. Then with an admin actor and the same action, asserts true.

Wire these into `package.json`:
```json
"scripts": {
  "db:reset": "tsx scripts/db-reset.ts",
  "db:seed": "tsx scripts/seed-base.ts",
  "smoke": "tsx scripts/smoke.ts",
  "test:audit": "tsx scripts/test-audit.ts",
  "test:rbac": "tsx scripts/test-rbac.ts"
}
```

### How to test it
```bash
pnpm db:up
pnpm db:reset
pnpm db:seed
pnpm dev &
sleep 5
pnpm smoke
pnpm test:audit
pnpm test:rbac
pnpm test          # vitest unit suite
pnpm typecheck
pnpm lint
```

### Test gate (must all pass to open Phase 1)
- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test` green
- [ ] `pnpm smoke` returns 0
- [ ] `pnpm test:audit` returns 0
- [ ] `pnpm test:rbac` returns 0
- [ ] `pnpm db:reset && pnpm db:seed` runs cleanly on a fresh container

### Non-negotiables
- No mutation function exists outside `withAudit`. You should be able to grep for raw `prisma.something.create` in the domain layer and find nothing — they all go through `withAudit`.
- The `audit_logs` table is **append-only**. No domain code calls `update` or `delete` on it.

---

## Phase 1 — Multi-event core (Day 2, 13 May)

### What we're building
One platform that can hold many events. Every URL starts with `/[eventSlug]/...`. Bad slugs 404. Admin can create events, switch lifecycle states (`pre_event → event_day → post_event_archive`), and apply per-event branding (colors, logo).

### Files & DB tables
- New files:
  - `apps/web/middleware.ts` — resolves event slug from URL
  - `apps/web/app/[eventSlug]/layout.tsx` — wraps every attendee page, injects branding
  - `apps/web/app/(admin)/admin/events/page.tsx` — admin events list
  - `apps/web/app/(admin)/admin/events/[id]/page.tsx` — single event edit
  - `packages/domain/event-lifecycle.ts` — the state machine
- DB tables:
  - `events` extended: `brand_tokens jsonb`, `lifecycle_state enum`, `feature_flags jsonb`

### How to build it
1. **Slug middleware.** In `apps/web/middleware.ts`, read the first path segment, query a small Redis cache (`event:slug:<slug>` TTL 60 s), fall back to DB. On miss, `notFound()`. On hit, attach `eventId` to the request via a header (`x-event-id`) for server components to read.
2. **Layout-level branding.** In `app/[eventSlug]/layout.tsx`, fetch the event's `brand_tokens` and emit them as CSS variables in a `<style>` tag at the top of the body. Tailwind classes consume the CSS variables.
3. **Lifecycle state machine.** In `packages/domain/event-lifecycle.ts`, export `canTransition(from, to)` and `transition(eventId, to, actor, reason)`. `transition` locks the event row (`SELECT ... FOR UPDATE`), checks `canTransition`, updates, writes an audit row.
4. **Event Prisma scope.** In `packages/db/event-scope.ts`, add a Prisma middleware that injects `where: { event_id }` on every read for event-scoped tables. Tables that should not scope (like `users`) are in an opt-out set.
5. **Admin events UI.** Plain forms — list, create, edit, transition. No styling polish in this phase; we'll come back.

### Scripts to create
1. **[scripts/seed-events.ts](../scripts/seed-events.ts)** — adds two events (`sge-2026`, `sge-2027`) so we can test isolation.
2. **[scripts/test-event-isolation.ts](../scripts/test-event-isolation.ts)** — seeds 10 attendees into `sge-2026`, queries attendees in `sge-2027`, asserts 0 rows. Also queries via the scoped Prisma client with the wrong `eventId` set, asserts 0 rows (proves middleware works).
3. **[scripts/test-lifecycle.ts](../scripts/test-lifecycle.ts)** — tries every legal transition (should succeed) and every illegal transition (should throw with a specific error code).
4. **[scripts/test-branding.ts](../scripts/test-branding.ts)** — patches an event's `brand_tokens` to a fixed color, curls the layout HTML, greps for that color in the CSS variables block, asserts present.
5. **[scripts/test-slug-404.ts](../scripts/test-slug-404.ts)** — curls `/does-not-exist/home`, asserts 404.

`package.json` additions:
```json
"test:isolation": "tsx scripts/test-event-isolation.ts",
"test:lifecycle": "tsx scripts/test-lifecycle.ts",
"test:branding": "tsx scripts/test-branding.ts",
"test:slug": "tsx scripts/test-slug-404.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
pnpm dev &
sleep 5
pnpm test:slug
pnpm test:isolation
pnpm test:lifecycle
pnpm test:branding
pnpm smoke
```

### Test gate
- [ ] Bad slug returns 404 before any DB read.
- [ ] Cross-event reads return 0 rows even when the eventId is wrong.
- [ ] Legal lifecycle transitions succeed; illegal jumps throw.
- [ ] Changing brand tokens in admin changes the rendered CSS on the next request.
- [ ] All Phase 0 checks still pass.

### Non-negotiables
- Cross-event data leakage is **impossible by query design** (Prisma middleware), not just by app convention.
- Lifecycle is server-authorized. The client cannot drive transitions.

---

## Phase 2 — Identity, OTP, check-in (Day 3, 14 May)

### What we're building
Attendees can register with an email, get an OTP in their inbox (locally: MailHog), enter the app **before** verifying (so the desk line keeps moving), and verify later for prize eligibility. Auto-check-in fires on first event-day entry. Email is canonical and immutable.

### Files & DB tables
- New files:
  - `apps/web/app/[eventSlug]/join/page.tsx` — signup form
  - `apps/web/app/[eventSlug]/verify/page.tsx` — OTP entry
  - `packages/domain/identity.ts` — OTP issue/verify, signup, check-in
  - `packages/domain/session.ts` — iron-session wrapper
- DB tables:
  - `attendees` (id, event_id, user_id, email, real_name, business_name, phone, alias, is_verified, checked_in_at, competition_score int default 0, spendable_balance int default 0, reached_current_score_at timestamptz)
  - `pending_scans` (id, session_id, qr_code_id, created_at) — for pre-signup scans we replay later

### How to build it
1. **Signup form.** Single-screen mobile form: email, real name, business name, phone. On submit, creates `users` + `attendees` row, opens a session (`is_verified=false`), and triggers OTP issue.
2. **OTP issue.** Generate 6 digits with `crypto.randomInt`. Hash with SHA-256. Store in Redis: `otp:{event_id}:{email}` → `{ hash, attempts: 0 }`, TTL 600 s. Send via the email module (locally: SMTP to MailHog on `localhost:1025`).
3. **OTP verify.** Compare hash, increment attempts on miss. 5 misses → 15-min lockout key in Redis (`otp:lock:{event_id}:{email}`). On success, set `is_verified=true`, delete OTP key.
4. **Session.** Iron-session, HttpOnly + Secure (Secure off in dev). Cookie payload: `{ attendeeId, eventId, isVerified }`. TTL 12 h, refreshed on every request during event day.
5. **Pre-signup scan replay.** Browser gets an anonymous `session_id` cookie. If the user hits a `/scan/X` route before signing up, we record `pending_scans (session_id, qr_code_id)`. On signup, we replay: read all pending_scans for the session_id, replay each through the (yet-to-be-built) scoring engine, then delete the rows.
6. **Auto-check-in.** Middleware checks: event is in `event_day` AND attendee is logged in AND `checked_in_at IS NULL` → set `checked_in_at = now()`. Runs once.
7. **Rate limits.** Three OTP issues per email per 15 min, enforced in Redis via a sliding window.

### Scripts to create
1. **[scripts/seed-attendees.ts](../scripts/seed-attendees.ts)** — seeds 20 attendees with verified emails so other phases have data to work with.
2. **[scripts/mailhog-fetch-otp.ts](../scripts/mailhog-fetch-otp.ts)** — utility: takes an email, queries the MailHog API (`http://localhost:8025/api/v2/search`), parses the latest message body, returns the 6-digit OTP. Used by every later end-to-end script.
3. **[scripts/test-otp-flow.ts](../scripts/test-otp-flow.ts)** — full happy path: signup → fetch OTP from MailHog → verify → assert `is_verified=true`.
4. **[scripts/test-otp-rate-limit.ts](../scripts/test-otp-rate-limit.ts)** — issues 4 OTPs for the same email, asserts the 4th is rate-limited.
5. **[scripts/test-otp-lockout.ts](../scripts/test-otp-lockout.ts)** — issues an OTP, submits 6 wrong codes, asserts lockout key is set, asserts further verify returns "locked".
6. **[scripts/test-checkin.ts](../scripts/test-checkin.ts)** — sets event lifecycle to `event_day`, simulates an attendee request, asserts `checked_in_at` is set, simulates a second request, asserts `checked_in_at` did not change.
7. **[scripts/test-email-immutability.ts](../scripts/test-email-immutability.ts)** — tries to PATCH an attendee email via the tRPC endpoint, asserts 403.
8. **[scripts/test-presignup-replay.ts](../scripts/test-presignup-replay.ts)** — creates a session_id, calls `/scan/<test-qr>` while logged out, asserts `pending_scans` has a row. Signs up. Asserts the row is gone and (once Phase 5 lands) the score is awarded — for now just assert the row is consumed.

`package.json` additions:
```json
"test:otp": "tsx scripts/test-otp-flow.ts",
"test:otp:ratelimit": "tsx scripts/test-otp-rate-limit.ts",
"test:otp:lockout": "tsx scripts/test-otp-lockout.ts",
"test:checkin": "tsx scripts/test-checkin.ts",
"test:email-immutable": "tsx scripts/test-email-immutability.ts",
"test:presignup": "tsx scripts/test-presignup-replay.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
pnpm dev &
sleep 5
pnpm test:otp
pnpm test:otp:ratelimit
pnpm test:otp:lockout
pnpm test:checkin
pnpm test:email-immutable
pnpm test:presignup
```

Manual smoke (do this once):
- Open `http://localhost:3000/sge-2026/join`, sign up with `test@example.com`.
- Open `http://localhost:8025`, copy the OTP from the email body.
- Paste OTP. Verify session is verified.
- Close the tab. Reopen. You should still be logged in.

### Test gate
- [ ] OTP issue → MailHog has the email → verify works.
- [ ] 4th OTP request inside 15 min is blocked.
- [ ] 6 wrong codes lock out for 15 min.
- [ ] First event-day entry sets `checked_in_at`. Second entry does not change it.
- [ ] Email change attempt returns 403.
- [ ] Pre-signup scan row is preserved through signup and consumed after.

### Non-negotiables
- App entry works **before** OTP verification. The desk line cannot wait on email delivery.
- Email immutability is enforced at the domain layer, not just the UI.

---

## Phase 3 — Public content: Home, Agenda, Geeks, Sponsors, FAQs (Day 4–6, 15–17 May)

### What we're building
The five tabs the attendee sees: `Home`, `Agenda`, `Geeks`, `Rewards`, `Leaderboard`. Plus Sponsors, FAQs, Profile, and T&Cs outside the tab bar. Admin can edit any of this content. Live status (now / next) is computed server-side.

### Files & DB tables
- New files:
  - `apps/web/app/[eventSlug]/(attendee)/layout.tsx` — five-tab bottom nav
  - `apps/web/app/[eventSlug]/(attendee)/home/page.tsx`
  - `apps/web/app/[eventSlug]/(attendee)/agenda/page.tsx`
  - `apps/web/app/[eventSlug]/(attendee)/geeks/page.tsx`
  - `apps/web/app/[eventSlug]/(attendee)/sponsor/[id]/page.tsx`
  - `apps/web/app/[eventSlug]/(attendee)/faqs/page.tsx`
  - Admin CRUD pages for each
- DB tables:
  - `agenda_sessions` (id, event_id, title, description, stage, category, type, starts_at, ends_at, speaker_id, sponsor_id)
  - `geeks` (id, event_id, name, photo_url, bio, contact_email, calendly_url, is_william bool default false)
  - `sponsors` (id, event_id, name, tier, logo_url, page_html, lead_capture_enabled bool)
  - `sponsor_interest` (id, event_id, attendee_id, sponsor_id, consented bool, created_at, undone_at)
  - `faqs` (id, event_id, question, answer, sort_order)
  - `announcements` (id, event_id, title, body, posted_at, posted_by_user_id)

### How to build it
1. **Five-tab nav.** Server component with active-state highlight. No client JS needed.
2. **Home composition.** Server-renders `now`, `next`, last 3 announcements, attendee's score/rank/progress block. Score block is the only client island (refetches every 30 s via TanStack Query). All other blocks are static-on-arrival.
3. **Agenda live status.** Computed in SQL: `CASE WHEN now() BETWEEN starts_at AND ends_at THEN 'live' WHEN starts_at > now() THEN 'upcoming' ELSE 'ended' END`.
4. **Sponsor interest toggle.** Two-step: an interest row is created on first tap (`consented=false`), and a separate consent checkbox creates a second mutation that sets `consented=true`. Tap again to undo — sets `undone_at`.
5. **FAQs.** Plain admin CRUD. Attendee-side has a client-side fuzzy search via `fuse.js`. No server search needed at this scale.
6. **Announcements.** Admin form posts to a list. Attendees poll a `/api/announcements` route every 30 s.

### Scripts to create
1. **[scripts/seed-content.ts](../scripts/seed-content.ts)** — seeds 8 agenda sessions, 4 geeks (one is William), 6 sponsors, 12 FAQs.
2. **[scripts/test-agenda-status.ts](../scripts/test-agenda-status.ts)** — creates three sessions (past, live, upcoming) by setting their `starts_at`/`ends_at` around `now()`, fetches the agenda API, asserts each session shows the right status.
3. **[scripts/test-sponsor-interest.ts](../scripts/test-sponsor-interest.ts)** — toggles interest, asserts row exists with `consented=false`. Adds consent, asserts `consented=true`. Undoes, asserts `undone_at` is set. Asserts attendee's `competition_score` did NOT change at any step.
4. **[scripts/test-faq-search.ts](../scripts/test-faq-search.ts)** — seeds three FAQs, searches for a keyword in the second one, asserts the second one is first in the result.
5. **[scripts/test-announcement-poll.ts](../scripts/test-announcement-poll.ts)** — admin creates an announcement; attendee `/api/announcements` returns it within 30 s.
6. **[scripts/test-five-tab-nav.spec.ts](../scripts/test-five-tab-nav.spec.ts)** — Playwright test: open `/sge-2026/home`, assert the bottom nav has exactly five items and the visible labels are Home, Agenda, Geeks, Rewards, Leaderboard.

`package.json` additions:
```json
"test:agenda": "tsx scripts/test-agenda-status.ts",
"test:sponsor-interest": "tsx scripts/test-sponsor-interest.ts",
"test:faq": "tsx scripts/test-faq-search.ts",
"test:announcements": "tsx scripts/test-announcement-poll.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
tsx scripts/seed-attendees.ts
tsx scripts/seed-content.ts
pnpm dev &
sleep 5
pnpm test:agenda
pnpm test:sponsor-interest
pnpm test:faq
pnpm test:announcements
pnpm test:e2e -- scripts/test-five-tab-nav.spec.ts
```

Manual smoke:
- Visit `/sge-2026/home`. Are five tabs visible? Does the score widget show 0?
- Tap Agenda. Filter by stage. Is the right session marked `live`?
- Tap Geeks. Are all four visible? Does William's card mention the premium reward (placeholder text fine in this phase)?
- Tap a sponsor. Toggle interest. Did the toggle stick? Did consent appear separately?
- Search FAQs. Are matches highlighted?

### Test gate
- [ ] Five tabs only, in the right order.
- [ ] Agenda live status flips correctly around `now()`.
- [ ] Sponsor interest does not change any score.
- [ ] Consent is captured separately from interest.
- [ ] FAQ search returns relevant matches.
- [ ] Announcement appears in the attendee view within 30 s.

### Non-negotiables
- Sponsor consent is a separate, explicit action — never bundled with general T&Cs.
- Sponsor interest is reversible without side effects on scoring.

---

## Phase 4 — Business onboarding + QR generation (Day 7, 18 May)

### What we're building
Admin creates a Business. The system auto-generates exactly one immutable QR for that business. Staff can mint miscellaneous QRs (guest speakers, ad-hoc) but cannot regenerate a business QR. Every QR URL is HMAC-signed.

### Files & DB tables
- New files:
  - `apps/web/app/(admin)/admin/businesses/page.tsx` + edit page
  - `apps/web/app/(admin)/admin/qr/page.tsx` — staff-misc QR creation
  - `packages/domain/qr.ts` — generation, signing, validation
  - `packages/domain/qr-print.ts` — branded card composition
- DB tables:
  - `businesses` (id, event_id, name, contact_email, logo_url, created_at)
  - `qr_codes` (id, event_id, owner_type enum, owner_id, type enum, code unique, signature, points int, reveal_at, expires_at, zone_hint, active bool, created_by_user_id, created_at)
    - Unique constraint: `(event_id, business_id)` where `owner_type='business'`
    - Unique constraint: `(event_id, owner_type, owner_id, purpose_fingerprint)`

### How to build it
1. **Business CRUD.** Plain admin form.
2. **QR on create.** When a business is created, a domain function `qr.assignBusinessQr(business)` runs inside the same transaction. It creates exactly one QR with `owner_type='business'`, `owner_id=business.id`, `type='business'`. The unique constraint guarantees no second QR can be created later, even on a race.
3. **QR signing.** `signature = HMAC_SHA256(QR_SIGNING_SECRET, event_id + ':' + code + ':' + type)`. Stored alongside the code. The URL is `/{eventSlug}/scan/{code}?sig={signature}`.
4. **Staff-misc QR.** Staff UI has a constrained dropdown: `guest_speaker`, `ad_hoc_session`, `bonus_zone`. Mandatory `reason` field. Cannot pick `business`.
5. **Print cards.** A small page renders a branded card (logo + QR PNG + name) using `@vercel/og` (Satori). Admin can download A5/A4 PDF. Bulk export zips up all cards for an event via `jszip`.

### Scripts to create
1. **[scripts/seed-businesses.ts](../scripts/seed-businesses.ts)** — creates 8 businesses; each gets one QR.
2. **[scripts/test-business-qr-unique.ts](../scripts/test-business-qr-unique.ts)** — creates a business, then tries (via direct SQL) to insert a second QR for the same business with `owner_type='business'`. Asserts a unique-constraint error is raised.
3. **[scripts/test-business-qr-regenerate-blocked.ts](../scripts/test-business-qr-regenerate-blocked.ts)** — calls a hypothetical `qr.assignBusinessQr` again for an existing business. Asserts the function returns the existing QR (idempotent), not a new one.
4. **[scripts/test-staff-cannot-make-business-qr.ts](../scripts/test-staff-cannot-make-business-qr.ts)** — staff session calls the QR creation tRPC route with `type='business'`. Asserts 403.
5. **[scripts/test-qr-signature.ts](../scripts/test-qr-signature.ts)** — fetches an existing QR. Tampers with the `code` while keeping the `sig`. Asserts the scan endpoint (or signature verifier directly) rejects it.
6. **[scripts/test-bulk-print.ts](../scripts/test-bulk-print.ts)** — calls the bulk-print endpoint for an event. Asserts a ZIP file is returned. Unzips. Asserts there is exactly one PNG per QR in the event.

`package.json` additions:
```json
"test:qr:unique": "tsx scripts/test-business-qr-unique.ts",
"test:qr:idempotent": "tsx scripts/test-business-qr-regenerate-blocked.ts",
"test:qr:staff": "tsx scripts/test-staff-cannot-make-business-qr.ts",
"test:qr:sig": "tsx scripts/test-qr-signature.ts",
"test:qr:print": "tsx scripts/test-bulk-print.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
tsx scripts/seed-attendees.ts
tsx scripts/seed-businesses.ts
pnpm dev &
sleep 5
pnpm test:qr:unique
pnpm test:qr:idempotent
pnpm test:qr:staff
pnpm test:qr:sig
pnpm test:qr:print
```

### Test gate
- [ ] Exactly one QR per business. A second insert fails.
- [ ] `assignBusinessQr` called twice for the same business returns the same QR.
- [ ] Staff cannot mint a business QR.
- [ ] A tampered signature is rejected before any DB read.
- [ ] Bulk print returns a ZIP with one PNG per QR.

### Non-negotiables
- One business, one QR. Enforced by DB unique constraint, not just code.
- HMAC validation is server-side only.

---

## Phase 5 — Scoring engine, leaderboard (Day 8–11, 19–22 May)

### What we're building
The competition core. Attendee scans a QR → idempotent award → both ledgers (`competition_score`, `spendable_balance`) update → audit row written → leaderboard updates. Tie-break by earliest-to-reach-current-score. Anti-farming rate limit. Hidden bonus QRs respect their reveal window.

### Files & DB tables
- New files:
  - `apps/web/app/[eventSlug]/scan/[code]/page.tsx` — scan landing page
  - `apps/web/app/api/scan/[code]/route.ts` — POST the award
  - `apps/web/app/[eventSlug]/(attendee)/leaderboard/page.tsx`
  - `packages/domain/scoring.ts` — `awardScan(attendeeId, qrCodeId)`
  - `packages/domain/leaderboard.ts` — `getTop10AndOwnRank(eventId, attendeeId)`
- DB tables:
  - `scan_records` (id, event_id, attendee_id, qr_code_id, points_competition, points_spendable, awarded_at)
    - Unique constraint: `(attendee_id, qr_code_id)` — the second line of defence against double-credit
  - `attendees` extended: index on `(event_id, competition_score DESC, reached_current_score_at ASC)` for leaderboard reads.

### How to build it
1. **Scan flow.**
   - Attendee opens `/{eventSlug}/scan/{code}?sig=...`.
   - Server validates HMAC. Rejects on mismatch.
   - If attendee is not signed in: write to `pending_scans` (from Phase 2), redirect to signup. After signup, the replay step (Phase 2) calls `awardScan` for each pending row.
   - If signed in: call `awardScan(attendeeId, qrCodeId)`.
2. **`awardScan` — idempotent and atomic.**
   - Redis key `scan:{attendeeId}:{qrCodeId}` set with `SET NX EX 86400`. If it already exists, return `{ status: 'already_collected' }` without touching the DB.
   - Otherwise, open a Prisma transaction with `isolationLevel: 'Serializable'`:
     1. SELECT the QR. Check `active=true`, `reveal_at <= now() <= expires_at`, type-specific windows.
     2. INSERT `scan_records` (the unique constraint will throw if a parallel call beat us — handle as `already_collected`).
     3. UPDATE `attendees` SET `competition_score = competition_score + points`, `spendable_balance = spendable_balance + points`, `reached_current_score_at = now()` WHERE NOT already at that score.
     4. INSERT `audit_logs` row.
   - Return `{ status: 'awarded', points, newScore }`.
3. **Leaderboard.**
   - Read model: `SELECT alias, competition_score FROM attendees WHERE event_id=? ORDER BY competition_score DESC, reached_current_score_at ASC LIMIT 10`.
   - Plus `SELECT count(*) + 1 FROM attendees WHERE event_id=? AND (competition_score, reached_current_score_at) > (own.score, own.reached_at)` for own rank.
   - Cached in Redis with 30 s TTL. Invalidate on every score increase.
4. **Anti-farming rate limit.** 10 scans per attendee per minute via Redis sliding window.
5. **Hidden bonus.** If `qr.type='hidden_bonus'` and `now() < qr.reveal_at`, return a specific `not_yet_active` code so the UI shows the zone hint.

### Scripts to create
1. **[scripts/seed-qrs.ts](../scripts/seed-qrs.ts)** — seeds a mix: 6 sponsor QRs, 4 session QRs, 3 hidden-bonus QRs (one revealed, two not), 1 inactive QR.
2. **[scripts/test-scan-idempotent.ts](../scripts/test-scan-idempotent.ts)** — fires 100 parallel POSTs of the same `(attendee, qr)` via `Promise.all`. Asserts exactly one `scan_records` row exists and the attendee's score increased by exactly the QR's point value.
3. **[scripts/test-scan-redis-bypass.ts](../scripts/test-scan-redis-bypass.ts)** — temporarily flushes the Redis idempotency keyspace, then fires 50 parallel POSTs. The Redis layer cannot help here. Asserts the DB unique constraint still prevents double-credit.
4. **[scripts/test-scan-rate-limit.ts](../scripts/test-scan-rate-limit.ts)** — one attendee, 11 different QRs in a minute. Asserts the 11th returns 429.
5. **[scripts/test-hidden-bonus.ts](../scripts/test-hidden-bonus.ts)** — scans a hidden-bonus QR whose `reveal_at` is in the future. Asserts response is `not_yet_active`. Updates `reveal_at` to past. Asserts the next scan awards normally.
6. **[scripts/test-leaderboard.ts](../scripts/test-leaderboard.ts)** — seeds 15 attendees with varied scores and timestamps. Asserts top 10 ordering matches `score DESC, reached_current_score_at ASC`. Asserts the attendee at rank 12 sees their own rank correctly.
7. **[scripts/test-tie-break.ts](../scripts/test-tie-break.ts)** — two attendees both at 100 points; the earlier-timestamped one ranks higher.
8. **[scripts/test-leaderboard-anonymous.ts](../scripts/test-leaderboard-anonymous.ts)** — fetches the leaderboard API; asserts no row contains `real_name`, `email`, or `phone`.
9. **[scripts/test-scan-presignup-replay.ts](../scripts/test-scan-presignup-replay.ts)** — extends the Phase 2 test: pre-signup scan, signup, asserts the score is now awarded (closing the loop from Phase 2).

`package.json` additions:
```json
"test:scan:idempotent": "tsx scripts/test-scan-idempotent.ts",
"test:scan:redis-bypass": "tsx scripts/test-scan-redis-bypass.ts",
"test:scan:ratelimit": "tsx scripts/test-scan-rate-limit.ts",
"test:scan:hidden": "tsx scripts/test-hidden-bonus.ts",
"test:leaderboard": "tsx scripts/test-leaderboard.ts",
"test:leaderboard:anon": "tsx scripts/test-leaderboard-anonymous.ts",
"test:tiebreak": "tsx scripts/test-tie-break.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
tsx scripts/seed-attendees.ts
tsx scripts/seed-businesses.ts
tsx scripts/seed-qrs.ts
pnpm dev &
sleep 5
pnpm test:scan:idempotent
pnpm test:scan:redis-bypass
pnpm test:scan:ratelimit
pnpm test:scan:hidden
pnpm test:leaderboard
pnpm test:leaderboard:anon
pnpm test:tiebreak
pnpm test:presignup    # Phase 2 script — now should award the score
```

### Test gate
- [ ] 100 parallel scans → exactly one award.
- [ ] DB unique constraint catches double-credit even when Redis is bypassed.
- [ ] Rate limit kicks in at 11 scans/min.
- [ ] Hidden-bonus respects `reveal_at`.
- [ ] Leaderboard never returns real names.
- [ ] Tie-break ordering by earliest-reach holds.
- [ ] Pre-signup scan replays cleanly post-signup.

### Non-negotiables
- Idempotency is **two layers**: Redis + DB unique constraint. Both must exist. Both must be tested.
- The two ledgers are never conflated in a single SQL statement.
- The leaderboard alias-only contract is enforced at the API layer.

---

## Phase 6 — Rewards, redemption, William reconciliation (Day 11–12, 22–23 May)

### What we're building
The reward catalog. Attendees redeem with spendable balance. Staff redeem on behalf of an attendee (scan attendee profile QR → select reward → confirm). Admin can reverse. Inventory cannot oversell. William's premium reward only completes on a confirmed Calendly booking.

### Files & DB tables
- New files:
  - `apps/web/app/[eventSlug]/(attendee)/rewards/page.tsx`
  - `apps/web/app/(staff)/staff/redeem/page.tsx`
  - `apps/web/app/api/webhooks/calendly/[eventSlug]/route.ts`
  - `packages/domain/rewards.ts` — `redeem`, `reverse`, `claimWilliam`, `reconcileWilliam`
- DB tables:
  - `rewards` (id, event_id, name, type, cost int, inventory int, per_attendee_limit int, lock_until, expires_at, external_provider, redemption_policy)
    - CHECK: `inventory >= 0`
  - `redemption_records` (id, event_id, attendee_id, reward_id, state enum, staff_id, reason, calendly_event_id, created_at, completed_at)
  - `redemption_holds` (id, event_id, attendee_id, reward_id, created_at, expires_at) — used by William
  - `attendees`: CHECK `spendable_balance >= 0`

### How to build it
1. **Self-service redemption.**
   - Open a transaction (Serializable).
   - `SELECT ... FROM rewards WHERE id=? FOR UPDATE` — locks the row.
   - Check `inventory > 0`. Check per-attendee count. Check spendable balance.
   - UPDATE inventory and balance. INSERT `redemption_records`. INSERT `audit_logs`.
   - Idempotency key in Redis: `redeem:{attendeeId}:{rewardId}:{requestId}`.
2. **Staff redemption.** Same domain function with `staff_id` set.
3. **Admin reversal.** Separate function. Requires non-empty `reason`. Restores inventory and balance. Marks redemption `reversed`.
4. **William flow.**
   - "Claim" creates `redemption_holds` row + `redemption_records` with `state='pending_booking'`. Does **not** deduct balance.
   - Calendly webhook (`/api/webhooks/calendly/...`) validates HMAC, finds the hold by attendee email, deducts balance, sets `state='completed'`.
   - Reconciler runs every 5 min (Phase 7 sets up the scheduler; in Phase 6 just a script): for each pending hold older than X minutes, call Calendly API to check if a booking was made; complete the redemption if so.

### Scripts to create
1. **[scripts/seed-rewards.ts](../scripts/seed-rewards.ts)** — 10 normal rewards with varied inventory, 1 William premium reward.
2. **[scripts/test-redemption-happy.ts](../scripts/test-redemption-happy.ts)** — attendee with sufficient balance redeems. Asserts balance drops, inventory drops, redemption row in `completed`.
3. **[scripts/test-redemption-oversell.ts](../scripts/test-redemption-oversell.ts)** — reward with `inventory=1`. Fires 50 parallel redeem calls from 50 different attendees. Asserts exactly one succeeds, 49 receive `sold_out`.
4. **[scripts/test-redemption-insufficient.ts](../scripts/test-redemption-insufficient.ts)** — attendee with low balance tries to redeem a higher-cost reward. Asserts 400 `insufficient_balance`. Asserts no row created. Asserts balance unchanged.
5. **[scripts/test-redemption-limit.ts](../scripts/test-redemption-limit.ts)** — `per_attendee_limit=2`. Attendee redeems 2× successfully, 3rd attempt fails. Including parallel: fires 5 parallel calls, asserts exactly 2 succeed.
6. **[scripts/test-reversal.ts](../scripts/test-reversal.ts)** — admin reverses a completed redemption with `reason="customer cancelled"`. Asserts inventory restored, balance restored, audit row created. Tries reversal without `reason`, asserts 400.
7. **[scripts/test-william-claim.ts](../scripts/test-william-claim.ts)** — attendee claims William. Asserts redemption is `pending_booking`. Asserts balance NOT deducted.
8. **[scripts/simulate-calendly-webhook.ts](../scripts/simulate-calendly-webhook.ts)** — posts a signed fake Calendly payload to `/api/webhooks/calendly/sge-2026`. Used by the test below and by manual debugging.
9. **[scripts/test-william-webhook.ts](../scripts/test-william-webhook.ts)** — claim → fire webhook → assert `state='completed'`, balance deducted, audit row. Replay the same webhook, assert no double deduction.
10. **[scripts/test-william-reconciler.ts](../scripts/test-william-reconciler.ts)** — claim → skip the webhook → manually run the reconciler script with a stub Calendly response that says "booking confirmed" → assert completion.
11. **[scripts/test-spendable-never-negative.ts](../scripts/test-spendable-never-negative.ts)** — attempts to construct a state where balance would go negative (race between two redemptions). Asserts the CHECK constraint catches it if the application layer fails.

`package.json` additions:
```json
"test:redeem": "tsx scripts/test-redemption-happy.ts",
"test:redeem:oversell": "tsx scripts/test-redemption-oversell.ts",
"test:redeem:insufficient": "tsx scripts/test-redemption-insufficient.ts",
"test:redeem:limit": "tsx scripts/test-redemption-limit.ts",
"test:redeem:reverse": "tsx scripts/test-reversal.ts",
"test:william:claim": "tsx scripts/test-william-claim.ts",
"test:william:webhook": "tsx scripts/test-william-webhook.ts",
"test:william:reconcile": "tsx scripts/test-william-reconciler.ts",
"test:balance:nonneg": "tsx scripts/test-spendable-never-negative.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
tsx scripts/seed-attendees.ts
tsx scripts/seed-businesses.ts
tsx scripts/seed-qrs.ts
tsx scripts/seed-rewards.ts
pnpm dev &
sleep 5
pnpm test:redeem
pnpm test:redeem:oversell
pnpm test:redeem:insufficient
pnpm test:redeem:limit
pnpm test:redeem:reverse
pnpm test:william:claim
pnpm test:william:webhook
pnpm test:william:reconcile
pnpm test:balance:nonneg
```

### Test gate
- [ ] Happy redemption: balance and inventory move together.
- [ ] 50 parallel redemptions on 1-unit inventory: exactly one wins.
- [ ] Insufficient balance fails before any write.
- [ ] Per-attendee limit holds under parallel load.
- [ ] Reversal restores state and demands a reason.
- [ ] William claim does not deduct points.
- [ ] William webhook completes the redemption idempotently.
- [ ] Reconciler completes a hold even if the webhook never arrived.
- [ ] Spendable balance cannot go negative even when the app layer fails.

### Non-negotiables
- Inventory mutation and redemption row creation are atomic.
- William points deducted only on confirmed booking.
- DB CHECK constraints back up the application code.

---

## Phase 7 — Notifications + ops dashboard (Day 13, 24 May)

### What we're building
Admin broadcasts notifications (immediate or scheduled). Attendees see them in-app. Ops dashboard shows live event state with graceful degradation.

### Files & DB tables
- New files:
  - `apps/web/app/(admin)/admin/notifications/page.tsx`
  - `apps/web/app/(admin)/admin/ops/page.tsx`
  - `apps/web/app/api/notifications/feed/route.ts`
  - `apps/worker/src/jobs/notifications-fanout.ts`
  - `apps/worker/src/jobs/notifications-due-poll.ts`
  - `apps/worker/src/jobs/william-reconciliation.ts`
  - `packages/domain/notifications.ts`
- DB tables:
  - `notifications` (id, event_id, title, body, audience jsonb, scheduled_at, created_by_user_id, created_at)
  - `notification_recipients` (id, notification_id, attendee_id, delivered_at, read_at)
- Views for the ops dashboard:
  - `vw_ops_checkins`, `vw_ops_scans_per_minute`, `vw_ops_low_stock`, `vw_ops_recent_audit`

### How to build it
1. **Worker.** A small Node service that exposes `POST /jobs/:name`. The web app enqueues by calling `worker.dispatch(jobName, payload)`. Locally, "queue" is a Redis list with a poller in the worker.
2. **Immediate broadcast.** Admin form → `notifications` row → worker fans out to `notification_recipients` based on audience filter.
3. **Scheduled broadcast.** Same row with `scheduled_at` set. A poller in the worker runs every 60 s and dispatches due rows.
4. **Feed API.** Attendee polls `/api/notifications/feed?after=<timestamp>` every 30 s. TanStack Query handles stale-while-revalidate on the client.
5. **Ops dashboard.** Reads from the views. If a view query fails or returns stale, the widget shows "stale 2 min ago" rather than crashing.

### Scripts to create
1. **[scripts/test-broadcast.ts](../scripts/test-broadcast.ts)** — admin sends broadcast to "all". Worker dispatches. Asserts every attendee has a `notification_recipients` row within 30 s.
2. **[scripts/test-scheduled.ts](../scripts/test-scheduled.ts)** — schedules a notification for `now() + 70s`. Waits 90s. Asserts it was delivered.
3. **[scripts/test-notification-feed.ts](../scripts/test-notification-feed.ts)** — admin sends broadcast. Attendee feed API returns it. Marks read. Next call returns `read_at` set.
4. **[scripts/test-ops-dashboard.ts](../scripts/test-ops-dashboard.ts)** — seeds known counts, hits each ops view endpoint, asserts numbers match the seeds.
5. **[scripts/test-ops-degradation.ts](../scripts/test-ops-degradation.ts)** — drops the `vw_ops_low_stock` view temporarily. Asserts the dashboard returns the other widgets and shows the low-stock widget as "unavailable", with HTTP 200 overall (not 500).
6. **[scripts/run-worker-locally.ts](../scripts/run-worker-locally.ts)** — convenience: starts the worker with verbose logging and watches the Redis queue. Useful for debugging.

`package.json` additions:
```json
"test:broadcast": "tsx scripts/test-broadcast.ts",
"test:scheduled": "tsx scripts/test-scheduled.ts",
"test:notif-feed": "tsx scripts/test-notification-feed.ts",
"test:ops": "tsx scripts/test-ops-dashboard.ts",
"test:ops:degrade": "tsx scripts/test-ops-degradation.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
tsx scripts/seed-events.ts
tsx scripts/seed-attendees.ts
tsx scripts/seed-rewards.ts
pnpm dev &
pnpm dev:worker &
sleep 5
pnpm test:broadcast
pnpm test:scheduled
pnpm test:notif-feed
pnpm test:ops
pnpm test:ops:degrade
```

### Test gate
- [ ] Broadcast reaches all targeted attendees within 30 s.
- [ ] Scheduled notification fires within ±30 s of `scheduled_at`.
- [ ] Feed API returns notifications and tracks `read_at`.
- [ ] Ops dashboard numbers match underlying data.
- [ ] One broken widget does not break the whole page.

### Non-negotiables
- Every notification has a recorded actor.
- Partial dashboard failures degrade, do not crash.

---

## Phase 8 — Reporting, exports, archive (Day 14, 25 May)

### What we're building
Admin can export everything (CSV/JSON) and the export always reflects the latest committed data. Archive mode kicks in at the event end. Attendees keep access for 10 days. Admin can reopen access for a specific attendee.

### Files & DB tables
- New files:
  - `apps/web/app/(admin)/admin/exports/page.tsx`
  - `apps/web/app/api/exports/[type]/route.ts`
  - `apps/worker/src/jobs/archive-transition.ts`
  - `packages/domain/exports.ts`
  - `packages/domain/archive.ts`
- DB additions:
  - `access_overrides` (id, event_id, attendee_id, granted_until, granted_by_user_id, reason, created_at)

### How to build it
1. **Streaming CSV.** Use `pg-query-stream` with `COPY (SELECT ...) TO STDOUT WITH CSV HEADER`. Keeps memory flat.
2. **Consent filter.** Sponsor lead export's SQL has `WHERE consented = true AND undone_at IS NULL`. No application-layer filtering.
3. **`as_of` timestamp.** The export records `now()` at the start of the query and stamps it in the response header and audit row.
4. **Archive middleware.** When `event.lifecycle_state='post_event_archive'`, every mutating route returns 403 unless `actor.type='admin'`.
5. **10-day window.** Derived: `event.ends_at + interval '10 days'`. Attendee access middleware checks this on every request. An access_override row can extend it.
6. **Local cron simulation.** A simple script run via `setInterval` in the worker that ticks the archive transition daily (in dev, every 30 s for speed).

### Scripts to create
1. **[scripts/test-export-attendees.ts](../scripts/test-export-attendees.ts)** — calls export, parses CSV, asserts every seeded attendee is present with the right columns.
2. **[scripts/test-export-realtime.ts](../scripts/test-export-realtime.ts)** — writes a new scan, immediately runs export, asserts the scan is in the CSV. Asserts the `as_of` header is within 5 s of `now()`.
3. **[scripts/test-export-sponsor-consent.ts](../scripts/test-export-sponsor-consent.ts)** — seeds 10 interested attendees, only 4 with consent. Sponsor lead export returns exactly 4 rows.
4. **[scripts/test-archive-transition.ts](../scripts/test-archive-transition.ts)** — flips event to `post_event_archive`. Asserts `/scan/*` and `/rewards/*` mutations return 403 for attendees. Asserts admin can still mutate.
5. **[scripts/test-10-day-expiry.ts](../scripts/test-10-day-expiry.ts)** — fast-forwards `event.ends_at` to 11 days ago. Asserts attendee access returns 403 with a "closed" page. Then sets it to 9 days ago, asserts access works.
6. **[scripts/test-admin-reopen.ts](../scripts/test-admin-reopen.ts)** — after expiry, admin creates an `access_overrides` row for one attendee. Asserts that attendee can access; others still cannot.
7. **[scripts/test-final-leaderboard-auth.ts](../scripts/test-final-leaderboard-auth.ts)** — in archive mode, leaderboard requires auth. Asserts a logged-out request returns 401; logged-in returns the leaderboard.

`package.json` additions:
```json
"test:export:attendees": "tsx scripts/test-export-attendees.ts",
"test:export:realtime": "tsx scripts/test-export-realtime.ts",
"test:export:consent": "tsx scripts/test-export-sponsor-consent.ts",
"test:archive": "tsx scripts/test-archive-transition.ts",
"test:archive:expiry": "tsx scripts/test-10-day-expiry.ts",
"test:archive:reopen": "tsx scripts/test-admin-reopen.ts",
"test:archive:leaderboard-auth": "tsx scripts/test-final-leaderboard-auth.ts"
```

### How to test it
```bash
pnpm db:reset && pnpm db:seed
# seed everything from phases 1-6
tsx scripts/seed-events.ts
tsx scripts/seed-attendees.ts
tsx scripts/seed-businesses.ts
tsx scripts/seed-qrs.ts
tsx scripts/seed-rewards.ts
tsx scripts/seed-content.ts
pnpm dev &
pnpm dev:worker &
sleep 5
pnpm test:export:attendees
pnpm test:export:realtime
pnpm test:export:consent
pnpm test:archive
pnpm test:archive:expiry
pnpm test:archive:reopen
pnpm test:archive:leaderboard-auth
```

### Test gate
- [ ] Exports reflect data committed seconds before the request.
- [ ] Sponsor exports never contain non-consenting attendees.
- [ ] Archive transition blocks mutations for attendees, allows admin.
- [ ] 10-day expiry works in both directions.
- [ ] Admin reopen restores access for a single attendee.
- [ ] Final leaderboard is auth-required during the archive window.

### Non-negotiables
- Non-consenting data is **never** in a sponsor export.
- Archive policies are enforced server-side.

---

## Phase 9 — Local hardening, load, security, end-to-end UAT (Day 14, 25 May)

### What we're building
Confidence. We push our laptop stack harder than it will be pushed in production, find the breaking points, fix them, and run the full attendee journey end-to-end as a final UAT pass.

### How to build it
1. **k6 load profiles.** Install k6 via Homebrew. Write three profiles in `tests/load/`:
   - `scan-burst.js` — 500 RPS scan attempts mixing fresh and duplicate.
   - `redeem-rush.js` — 100 RPS on a 10-unit reward.
   - `leaderboard-storm.js` — 1,000 RPS leaderboard reads.
2. **End-to-end Playwright suite.** Five top-level journeys, each as its own `*.spec.ts`:
   - Signup → OTP → check-in → scan → leaderboard rank update.
   - Pre-signup scan → signup → score awarded retroactively.
   - Staff redemption flow.
   - William claim → webhook → completion.
   - Archive transition → attendee sees closed page → admin reopens for one attendee → that attendee gets back in.
3. **Security pass.** A small `scripts/security-check.ts` that runs a list of curl-based probes (admin route without auth, tampered HMAC, OTP brute force, SQL injection patterns in known query params).

### Scripts to create
1. **[tests/load/scan-burst.js](../tests/load/scan-burst.js)** — k6 scenario.
2. **[tests/load/redeem-rush.js](../tests/load/redeem-rush.js)** — k6 scenario.
3. **[tests/load/leaderboard-storm.js](../tests/load/leaderboard-storm.js)** — k6 scenario.
4. **[scripts/load-summary.ts](../scripts/load-summary.ts)** — runs all three k6 scripts in sequence, captures stdout, prints a pass/fail summary against thresholds (p95 < 400ms scan, p95 < 200ms leaderboard, no errors above 0.1%).
5. **[scripts/security-check.ts](../scripts/security-check.ts)** — runs ~20 probes, prints a report. Exits 1 on any high-severity finding.
6. **[tests/e2e/journey-1-happy.spec.ts](../tests/e2e/journey-1-happy.spec.ts)** through `journey-5-archive.spec.ts` — Playwright suites.
7. **[scripts/full-uat.ts](../scripts/full-uat.ts)** — runs ALL `test:*` scripts from every phase in sequence. The "is the laptop ready" master check. Exits 0 only if everything is green.

`package.json` additions:
```json
"load:all": "tsx scripts/load-summary.ts",
"security": "tsx scripts/security-check.ts",
"uat": "tsx scripts/full-uat.ts"
```

### How to test it
```bash
# clean slate
pnpm db:reset && pnpm db:seed
# seed everything
for s in events attendees businesses qrs rewards content; do tsx scripts/seed-$s.ts; done
pnpm dev &
pnpm dev:worker &
sleep 5

# load
pnpm load:all

# security
pnpm security

# end-to-end
pnpm test:e2e

# master check
pnpm uat
```

### Test gate
- [ ] p95 `/api/scan/*` < 400 ms at 500 RPS sustained for 5 min.
- [ ] p95 leaderboard < 200 ms at 1,000 RPS.
- [ ] Redeem rush: exactly 10 winners out of 100, no oversell.
- [ ] Security probes: no high-severity findings.
- [ ] All 5 Playwright journeys pass.
- [ ] `pnpm uat` exits 0.

### Non-negotiables
- The master `pnpm uat` script is the gate. If it doesn't exit 0, the laptop is not ready and we do not consider deployment.

---

# Part 3 — Deployment (deferred)

Deployment is **not in scope for this document**. We come back to this only after Phase 9's `pnpm uat` exits 0 on a clean laptop run.

When that happens, we will write a separate doc covering:

- Target environment (GCP — Cloud Run, Cloud SQL, Memorystore, etc.)
- Staging vs production project isolation
- CI/CD pipeline (GitHub Actions + Cloud Build)
- Secret management
- Scaling configuration
- Monitoring and alerting
- Pre-event runbook (T-48h, T-24h, T-0)
- Backup and disaster recovery

Until then: **do not provision cloud resources.** All work happens on the laptop.

---

# Appendix A — The scripts you'll have at the end of Phase 9

By the end of the build, your `scripts/` folder looks like this:

```
scripts/
├── db-reset.ts
├── smoke.ts
├── full-uat.ts
├── load-summary.ts
├── security-check.ts
├── seed-base.ts
├── seed-events.ts
├── seed-attendees.ts
├── seed-businesses.ts
├── seed-content.ts
├── seed-qrs.ts
├── seed-rewards.ts
├── mailhog-fetch-otp.ts
├── simulate-calendly-webhook.ts
├── run-worker-locally.ts
├── test-audit.ts
├── test-rbac.ts
├── test-event-isolation.ts
├── test-lifecycle.ts
├── test-branding.ts
├── test-slug-404.ts
├── test-otp-flow.ts
├── test-otp-rate-limit.ts
├── test-otp-lockout.ts
├── test-checkin.ts
├── test-email-immutability.ts
├── test-presignup-replay.ts
├── test-agenda-status.ts
├── test-sponsor-interest.ts
├── test-faq-search.ts
├── test-announcement-poll.ts
├── test-business-qr-unique.ts
├── test-business-qr-regenerate-blocked.ts
├── test-staff-cannot-make-business-qr.ts
├── test-qr-signature.ts
├── test-bulk-print.ts
├── test-scan-idempotent.ts
├── test-scan-redis-bypass.ts
├── test-scan-rate-limit.ts
├── test-hidden-bonus.ts
├── test-leaderboard.ts
├── test-leaderboard-anonymous.ts
├── test-tie-break.ts
├── test-redemption-happy.ts
├── test-redemption-oversell.ts
├── test-redemption-insufficient.ts
├── test-redemption-limit.ts
├── test-reversal.ts
├── test-william-claim.ts
├── test-william-webhook.ts
├── test-william-reconciler.ts
├── test-spendable-never-negative.ts
├── test-broadcast.ts
├── test-scheduled.ts
├── test-notification-feed.ts
├── test-ops-dashboard.ts
├── test-ops-degradation.ts
├── test-export-attendees.ts
├── test-export-realtime.ts
├── test-export-sponsor-consent.ts
├── test-archive-transition.ts
├── test-10-day-expiry.ts
├── test-admin-reopen.ts
└── test-final-leaderboard-auth.ts

tests/
├── e2e/
│   ├── journey-1-happy.spec.ts
│   ├── journey-2-presignup.spec.ts
│   ├── journey-3-staff-redeem.spec.ts
│   ├── journey-4-william.spec.ts
│   └── journey-5-archive.spec.ts
└── load/
    ├── scan-burst.js
    ├── redeem-rush.js
    └── leaderboard-storm.js
```

Every script is a single-purpose, idempotent, exit-code-driven check. They are how we know we shipped what we said we'd ship.

# Appendix B — Phase calendar at a glance (local-only)

| Day | Date | Phase | What "done" looks like |
|---|---|---|---|
| 1 | Tue 12 May | Phase 0 | `pnpm smoke` returns 0 |
| 2 | Wed 13 May | Phase 1 | `pnpm test:isolation && pnpm test:lifecycle` green |
| 3 | Thu 14 May | Phase 2 | Signup + OTP via MailHog works manually and in scripts |
| 4–6 | Fri–Sun 15–17 May | Phase 3 | Five-tab IA visible, content CRUD works |
| 7 | Mon 18 May | Phase 4 | Business QR auto-created, signed, immutable |
| 8–11 | Tue–Fri 19–22 May | Phase 5 | 100-parallel scan test passes, leaderboard is anonymous |
| 11–12 | Fri–Sat 22–23 May | Phase 6 | William webhook completes the redemption; oversell test passes |
| 13 | Sun 24 May | Phase 7 | Broadcast in 30 s, ops dashboard reconciles |
| 14 | Mon 25 May | Phase 8 | Real-time exports + archive controls work |
| 14 | Mon 25 May | Phase 9 | `pnpm uat` exits 0 |
| 15 | Tue 26 May | — | **(Deployment plan begins separately only after Phase 9 is green)** |

# Appendix C — Glossary (because some of this gets jargon-heavy)

- **Idempotent.** Same input, same outcome — calling the function twice does not produce two awards.
- **Audit row.** A line in the `audit_logs` table that says "this actor did this thing at this time, here's the payload". Never updated, never deleted.
- **Ledger.** A running balance. We have two: `competition_score` (for the leaderboard) and `spendable_balance` (for redemptions).
- **HMAC.** A signature using a shared secret. Stops an attacker from making up QR URLs.
- **MailHog.** A local fake email inbox we use in development. No real emails go out.
- **k6.** A load testing tool. We run it against `localhost`.
- **Playwright.** A browser automation tool. We script real user flows with it.
- **Test gate.** The list of test cases that must pass for the phase to count as "done". No exceptions.

---

*End of local-first phased implementation plan.*
