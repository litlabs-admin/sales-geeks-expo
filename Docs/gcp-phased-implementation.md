# SalesGeek Scotland — GCP Phased Implementation & Deployment Plan
## Scottish Growth Expo 2026 — Event Companion Web App

> **Audience:** engineering team taking the platform from empty repo to production-live.
> **Target scale:** ~1,000 unique users on event day (26 May 2026), realistic peak concurrency ~300–500 users during keynote breaks.
> **Cloud:** Google Cloud Platform (existing credits).
> **Source of truth for scope:** [northstar.md](../northstar.md), [docs/read.md](../read.md), [deliverables.md](../deliverables.md).

This document is the operational playbook. It is structured in three parts:

1. **Stack & environments** (what we are using and why for the 1k/day target on GCP)
2. **Phased build plan** (what is built in each phase, how it is built, and the test gates that must pass before the next phase opens)
3. **Deployment** (local testing first, then scalable GCP deployment)

---

## Part 1 — Stack & Environments

### 1.1 Architecture overview on GCP

```
                           ┌────────────────────────┐
                           │   Cloudflare (DNS+WAF) │
                           │   app.salesgeek.scot   │
                           └───────────┬────────────┘
                                       │ HTTPS
                                       ▼
              ┌────────────────────────────────────────────┐
              │  GCP HTTPS Load Balancer + Cloud CDN       │
              │  + Cloud Armor (rate limit / WAF rules)    │
              └─────┬───────────────────────────┬──────────┘
                    │                           │
                    ▼                           ▼
        ┌──────────────────────┐    ┌──────────────────────┐
        │   Cloud Run service  │    │  Cloud Run service   │
        │   "web" (Next.js)    │    │  "worker"            │
        │   min=2, max=20      │    │  jobs/cron consumers │
        └──────┬───────────────┘    └──────────┬───────────┘
               │                               │
               │     ┌─────────────────────────┴──────────┐
               │     │                                    │
               ▼     ▼                                    ▼
        ┌────────────────────┐                  ┌────────────────────┐
        │ Cloud SQL Postgres │                  │  Memorystore Redis │
        │ 15, HA, regional   │                  │  Basic 1GB (stg)   │
        │ private IP         │                  │  Standard 5GB (prod)│
        └────────────────────┘                  └────────────────────┘

   Cloud Storage  Secret Manager  Cloud Tasks  Cloud Scheduler  Cloud Build
   (images/exports) (env/keys)    (deferred)   (cron)           (CI/CD)

   Cloud Logging + Cloud Monitoring + Error Reporting + Uptime Checks
```

### 1.2 Component choices (GCP-native first)

| Layer | Service | Tier (prod) | Reason |
|---|---|---|---|
| Compute (web + API) | Cloud Run | min=2, max=20, 1 vCPU / 1 GiB, concurrency 80 | Serverless Next.js, fast scaling, scale-to-(min=2) avoids cold starts on event day |
| Compute (workers) | Cloud Run jobs / 2nd service | min=1, max=5 | Background processing isolated from request path |
| Database | Cloud SQL for PostgreSQL 15 | `db-custom-2-7680` (2 vCPU, 7.5 GB), HA enabled, regional | Managed Postgres with auto-failover; Prisma compatibility |
| Connection pooling | Cloud SQL Auth Proxy + PgBouncer sidecar | session pool 50 per Run instance | Cloud Run instances open new conns; pooler keeps DB conn count safe |
| Cache / Redis | Memorystore for Redis | Standard tier, 5 GB, read replicas off | OTP, idempotency, rate limit, leaderboard cache |
| Object storage | Cloud Storage (GCS) | Standard, multi-region `eu` | Sponsor logos, speaker photos, QR PNG/SVG, CSV exports |
| Secrets | Secret Manager | per env | No secrets in repo or env files in cloud |
| Deferred jobs | Cloud Tasks | named queues per job class | Notifications dispatch, email retries, William reconciliation |
| Scheduling | Cloud Scheduler | cron-style | Archive transition, reward expiry, daily backups |
| CI/CD | GitHub Actions + Cloud Build | per branch | Tests in GHA, build & deploy via Cloud Build |
| DNS / TLS | Cloudflare proxied → GCP HTTPS LB | full strict TLS | DDoS protection, edge cache, custom rules |
| Edge WAF | Cloud Armor | rate-limit, geo, WAF preset | Block obvious abuse on `/scan/*`, `/auth/otp/*` |
| Monitoring | Cloud Monitoring + Logging + Error Reporting | + Sentry for stack traces | First-class GCP integration + Sentry deep-dives |
| Email | Resend (external) | dedicated sub-domain | Transactional OTP/magic-link/Calendry confirms; DKIM/SPF/DMARC mandatory |
| Analytics & flags | PostHog Cloud (EU) | EU region | Funnels, feature flags for hot-disable |

> **Why not GKE?** GKE adds operator complexity we do not need at 1,000 users/day. Cloud Run gives us autoscale, zero-ops, and is cheaper for spiky traffic.

### 1.3 Why this is sized for 1,000 users/day

- **Traffic shape:** 1,000 unique users, but bursty around session breaks. Worst-case ~500 concurrent users issuing a QR scan and a leaderboard fetch within ~30 s. That is ~30–50 RPS sustained, ~150 RPS spike — well within Cloud Run autoscaling (each instance handles 80 concurrent at 1 vCPU).
- **Database:** A `db-custom-2-7680` Cloud SQL handles thousands of TPS for transactional writes when scoring writes are batched per scan (1 transaction = scan + ledger + audit). HA regional keeps us safe through a zone failure.
- **Redis:** 5 GB Standard tier is enormous for our key set; we only need ~150 MB peak. We size for HA, not capacity.
- **Cost envelope:** roughly £200–£400 in event-day GCP burn at this configuration, well inside available credits.

### 1.4 Environments

| Env | GCP Project | Domain | Notes |
|---|---|---|---|
| local | n/a | `http://localhost:3000` | Docker Compose Postgres + Redis |
| staging | `salesgeek-stg` | `staging.salesgeek.scot` | Full GCP stack, smaller tiers |
| production | `salesgeek-prd` | `app.salesgeek.scot` | HA Cloud SQL, min=2 Cloud Run |

Two GCP projects = hard isolation of IAM, billing, network, and audit logs.

### 1.5 Source layout

```
/
├── apps/
│   ├── web/                Next.js 14 App Router
│   └── worker/             Background worker (Cloud Run service)
├── packages/
│   ├── domain/             ScoringEngine, IdentityService, QRSystem,
│   │                       RewardEngine, SponsorLayer, AuditEngine
│   ├── db/                 Prisma schema + client
│   ├── contracts/          Zod schemas / shared types
│   └── config/             env loader, feature flags
├── infra/
│   ├── terraform/          GCP infra-as-code
│   ├── docker/             Dockerfiles for web & worker
│   └── cloudbuild/         Cloud Build pipelines
├── tests/
│   └── e2e/                Playwright suites
└── Docs/                   (this folder)
```

---

## Part 2 — Phased build plan

Every phase has the same shape:

1. **Goal** — what this phase makes real
2. **Build** — concrete components, files, and DB shapes
3. **How** — the implementation approach (libraries, patterns, gotchas)
4. **Test gate** — the test cases that MUST pass to open the next phase
5. **Non-negotiables** — rules that cannot be broken under deadline pressure

The build order matches [northstar.md](../northstar.md) §10 and [implementation-phases.md](implementation-phases.md), tightened for the 1k-user GCP target.

> **Phase calendar (today is 2026-05-11, event is 2026-05-26).** We have 15 days. Phases 0–2 must close by Wed 13 May. QR engine (Phase 5) by Fri 21 May. Hardening (Phase 9) by Sun 24 May. Production go-live Sun 25 May late, event day 26 May.

---

### Phase 0 — Foundation (Day 1–2, 12–13 May)

**Goal.** A pushable monorepo with a clean DB migration, audit-aware service layer, and CI green on a vertical "hello world" slice.

**Build**

- pnpm + Turborepo workspace with `apps/web`, `apps/worker`, `packages/*`.
- Dockerfile for `apps/web` (multi-stage, distroless-node20 base).
- Prisma schema with the foundational tables only:
  - `events` (id, slug, name, brand_tokens jsonb, lifecycle_state, starts_at, ends_at)
  - `users` (id, type [`attendee|admin|staff|business`], email, created_at)
  - `attendees`, `staff_accounts`, `admins`, `businesses`
  - `audit_logs` (actor_id, actor_type, action, target_type, target_id, reason, payload jsonb, created_at)
- RBAC primitives in `packages/domain/rbac.ts` (`canDoAction(actor, action, resource)`).
- tRPC root router with three sub-routers (`attendee`, `admin`, `staff`) and a `protectedProcedure` middleware that checks role.
- Logger (`pino`) wired to stdout in JSON for Cloud Logging.
- GitHub Actions: `lint` → `typecheck` → `vitest` → `prisma migrate diff` check.
- Cloud Build config that builds the `web` image and pushes to Artifact Registry.

**How**

- Use `pnpm dlx create-next-app` for the base, then convert to monorepo by moving into `apps/web`.
- Prisma: one schema, one connection URL, migrations checked into `packages/db/migrations`. CI runs `prisma migrate diff --from-empty --to-schema-datamodel` against the schema for drift detection.
- Audit logger sits as a Prisma middleware AND a service wrapper. Every domain mutation function calls `audit.record({...})` inside the same `$transaction` so audit cannot be lost.
- Pino with `formatters.level = (label) => ({ severity: label.toUpperCase() })` so Cloud Logging shows the right severity.

**Test gate**

1. `pnpm typecheck && pnpm lint && pnpm test` is green in CI.
2. `prisma migrate reset && prisma migrate deploy` runs cleanly on a fresh Postgres.
3. RBAC unit test: a `staff` token cannot call an `admin`-only tRPC procedure.
4. Audit unit test: a protected mutation produces exactly one `audit_logs` row inside the same transaction; rolling back the mutation rolls back the audit row.
5. Container test: `docker build` of `apps/web` succeeds and the image starts and serves `/health` 200.

**Non-negotiables**

- No mutation route can ship without an audit hook.
- No table can exist without `event_id` if it carries event data.

---

### Phase 1 — Multi-event core (Day 2–3, 13–14 May)

**Goal.** One platform, many events; an event slug resolves a fully isolated context. Lifecycle state transitions are server-authorized.

**Build**

- Event CRUD in admin (`/admin/events`).
- Slug routing: every attendee route lives under `/[eventSlug]/...`. Middleware resolves the event row at the edge and attaches it to the request context.
- Lifecycle state machine in `packages/domain/event-lifecycle.ts`: `pre_event → event_day → post_event_archive`. Transitions are admin-triggered tRPC mutations; no backwards transitions, no skips.
- Branding tokens (`colors`, `logo_url`, `accent`) stored as JSONB on `events`, injected as CSS custom properties at the layout level.
- Feature flag table (`event_feature_flags`) for hot-disabling QR types, leaderboard, rewards.

**How**

- Use Next.js middleware (Edge runtime) to read the slug from the URL, fetch from a small Redis cache, and call `notFound()` if unknown. Cache TTL 60 s, invalidated on event mutation.
- Lifecycle transitions wrap a Postgres `SELECT ... FOR UPDATE` on the event row to serialise concurrent admin clicks.
- Prisma middleware in `packages/db/event-scope.ts` injects `where: { event_id }` automatically on every read for event-scoped tables. Tables that should NOT auto-scope (like `users`) are listed in an opt-out set.

**Test gate**

1. `/unknown-slug/...` returns 404 from middleware before any DB query.
2. Lifecycle transition test: `pre_event → post_event_archive` is rejected; `pre_event → event_day → post_event_archive` is accepted.
3. Data isolation test: seed two events, query attendees in event A, assert zero rows from event B.
4. Branding test: changing a token in admin changes the rendered CSS on the next request (no cache leak across events).
5. Feature flag test: disabling `qr_scoring` in admin causes `/scan/...` to return a fixed "disabled" message without hitting scoring code.

**Non-negotiables**

- Cross-event leakage must be impossible by query design (Prisma middleware), not just by app convention.
- Lifecycle is server-authorized only; clients cannot drive transitions.

---

### Phase 2 — Identity, OTP, check-in (Day 3–4, 14–15 May)

**Goal.** Attendees can register at the desk, receive an OTP, enter the app before verification, and get auto-checked-in on event day. Email is canonical identity.

**Build**

- Signup flow at `/[eventSlug]/join` (mobile-first, single screen).
- OTP issue + verify endpoints with rate limit.
- `iron-session` cookie carrying `attendee_id`, `event_id`, `is_verified`.
- Auto check-in middleware that flips `attendees.checked_in_at` on first event-day entry.
- Attendee profile QR generation (a one-time, immutable QR on signup, stored in `qr_codes` with `owner_type='attendee'`).
- Pre-signup scan preservation: a scan made before signup writes a `pending_scans` row keyed by `session_id`; on signup the row is replayed against the new attendee.

**How**

- OTP: 6-digit, generated with `crypto.randomInt`, SHA-256 hashed at rest, 10-min TTL in Redis (`otp:{email}` keyed by event), max 5 verification attempts then 15-min lockout.
- Rate limit: `@upstash/ratelimit` against Memorystore — sliding window, 3 OTP issues per email per 15 min. (Or a small custom sliding-window in Lua against Memorystore.)
- Email sends via Resend, React Email templates in `packages/email`.
- Session cookie: HttpOnly, SameSite=Strict, Secure, `__Host-` prefix. 12-hour TTL with silent refresh on each request during event day.
- Identity immutability rules enforced in `packages/domain/identity.ts`: email immutable, business locked after first signup, alias auto-generated with one self-service edit.

**Test gate**

1. Happy path: signup → OTP → verify → session has `is_verified=true`.
2. Pre-signup QR scan is preserved through the signup flow and the points award after verification.
3. 6 invalid OTP attempts trigger lockout; new OTP can only be issued after window.
4. Duplicate signup with same email maps to the existing attendee, not a new row.
5. Auto check-in: simulate event-day entry, assert `checked_in_at` is set; second entry does not modify it.
6. Email immutability: a tRPC call attempting to change an attendee's email returns 403.
7. Session continuity: closing and reopening the app within the cookie TTL does not require re-OTP.

**Non-negotiables**

- App entry must work before OTP verification (desk flow). Prize eligibility, not app access, is what OTP gates.
- Email immutability is enforced at the domain layer (Prisma + service), not just UI.

---

### Phase 3 — Public content: Home, Agenda, Geeks, Sponsors, FAQs (Day 4–6, 15–17 May)

**Goal.** The five-tab attendee IA is complete. Admin can edit content live during the event.

**Build**

- Five-tab attendee shell: `Home`, `Agenda`, `Geeks`, `Rewards`, `Leaderboard`. Sponsors, FAQs, Profile, T&Cs live outside the tab bar.
- Home composition blocks: live-now, up-next, announcements, points, rank, progress, William reward CTA.
- Agenda CRUD with stage / category / type filters and live status (`upcoming` / `live` / `ended`).
- Geeks tab with four host profiles (photo, bio, contact, Calendly link).
- Sponsor pages with scan state, interest toggle (undoable), explicit consent-gated lead sharing.
- FAQ entity, searchable, admin-editable on event day.

**How**

- Pages are React Server Components by default. The Home page hydrates only the score widget on the client; everything else is static-on-arrival, refetched on tab focus.
- Agenda live status is derived server-side from `now()` against `starts_at` / `ends_at`; no client clocks.
- Sponsor interest is a separate table `sponsor_interest` with `consented` boolean. Lead exports filter on `consented = true` at the SQL level, not the UI.
- Announcement feed is a simple polling endpoint (`Cache-Control: max-age=15, stale-while-revalidate=30`); we deliberately do not use websockets for v1.

**Test gate**

1. IA test: only five tabs are visible at the bottom of attendee pages on mobile viewport.
2. Agenda filter test: filtering by `stage=main` and `type=keynote` returns only matching sessions and matches the API response.
3. Agenda status test: a session whose `starts_at` is now-10min and `ends_at` is now+20min returns `live`.
4. Sponsor interest test: toggling interest does not modify either ledger.
5. Sponsor consent test: lead export for sponsor X excludes attendees who toggled interest but did not consent.
6. FAQ test: admin edits an FAQ; the next attendee request returns the new text within 30 s.
7. Geeks test: all four profiles render with required fields populated.

**Non-negotiables**

- Sponsor consent is a separate explicit checkbox from general T&Cs and is stored independently.
- Sponsor interest is reversible without side-effects on scoring.

---

### Phase 4 — Business onboarding + QR generation (Day 6–7, 17–18 May)

**Goal.** Admin can create businesses; each business is automatically assigned exactly one permanent QR. Staff can mint miscellaneous QRs but never regenerate business QRs.

**Build**

- Business CRUD in admin (name, contact email, logo).
- Auto-generated single immutable QR on business creation (`qr_codes.owner_type='business'`, `unique(business_id)`).
- Staff-misc QR creation flow with policy guardrails (allowed categories only, mandatory `reason`).
- QR signing: HMAC-SHA256 over `event_id:code:type` using `QR_SIGNING_SECRET` from Secret Manager.
- QR print exports: SVG + PNG via `qrcode`, branded card composition via `@vercel/og` (Satori), bulk ZIP via `jszip`, uploaded to GCS.

**How**

- QR creation is idempotent: keyed by `(event_id, owner_type, owner_id, purpose_fingerprint)`. A second request returns the same QR record, not a new one.
- Business QR is enforced as immutable in the domain layer: `regenerateBusinessQr` does not exist; the staff path explicitly rejects business QR regeneration.
- QR PNG/SVG files are uploaded to a `gs://salesgeek-prd-qr-assets/<event_slug>/<qr_code_id>.png` path; we sign download URLs from the admin UI.

**Test gate**

1. Business creation produces exactly one row in `qr_codes`. A second creation call for the same business returns the existing QR.
2. Calling the QR-create endpoint for a business as a staff user returns 403.
3. Staff can create a miscellaneous QR with `reason="guest speaker"` but cannot create a `business` type QR.
4. QR signature validation rejects a tampered `code` or `sig`.
5. Bulk print export returns a ZIP containing one PNG per QR.

**Non-negotiables**

- Each business has exactly one QR. Unique DB constraint on `(business_id)` where `owner_type='business'`.
- HMAC validation is server-side only; clients never see the secret.

---

### Phase 5 — QR engine, scoring, leaderboard (Day 7–10, 18–21 May)

**Goal.** The competition core works end-to-end and is auditable, idempotent, and concurrent-safe.

**Build**

- Unified `/[eventSlug]/scan/[code]` route with HMAC validation, type dispatch (`sponsor` / `session` / `hidden_bonus` / `staff_validated` / `business`), and time-window enforcement.
- Idempotent `ScoringEngine.awardScan(attendeeId, qrCodeId)`:
  - Redis key `scan:{attendeeId}:{qrCodeId}` set with `SET NX EX 86400` as the idempotency lock.
  - Inside one Prisma `$transaction`: insert `scan_records`, increment both ledgers (`competition_score` and `spendable_balance`), insert `audit_logs`.
  - DB unique constraint on `(attendee_id, qr_code_id)` as the second line of defence — if Redis misses, the DB still cannot double-credit.
- Hidden bonus QR with `reveal_at` and `expires_at` timestamps; pre-reveal returns the specific "not active yet" code.
- Leaderboard read model: top 10 by `competition_score DESC, reached_at ASC`, plus the requesting attendee's own rank, returned together. Cached in Redis with 30-s TTL, invalidated on score change.
- Anti-farming rate limit: 10 scans per attendee per minute.

**How**

- Use `prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })` for the award path. Serializable is overkill for throughput but our write rate is well under what Cloud SQL can handle, and it makes the invariants trivial.
- Leaderboard tie-break (`reached_at`): we record the timestamp at which the attendee first reached their current score in a denormalized column `attendees_event.reached_current_score_at`. Updated only on score increase.
- Two-ledger invariant: `competition_score` is monotonically increasing in normal operation (only admin reversal can decrement it; reversals are a different code path with mandatory reason). `spendable_balance` rises on award and falls on redemption.
- The Edge runtime is used for the leaderboard read; the scan award is Node runtime because Prisma is not Edge-safe.

**Test gate**

1. Retry-storm test: 100 parallel POSTs of the same `(attendeeId, qrCodeId)` produce exactly one `scan_records` row and exactly one award.
2. Hidden bonus before `reveal_at` returns the correct "not active yet" code; after `reveal_at` it awards normally.
3. Session QR outside its `starts_at`/`ends_at` window is rejected.
4. Already-collected QR for the same attendee returns a 200 with `already_collected=true`, not an error.
5. Tie-break test: two attendees both at 100 points; the one who reached 100 first is ranked higher.
6. Leaderboard shape contract: top 10 aliases + own rank + prize deadline, no real names.
7. Rate limit test: 11 scans in 60 s from one attendee returns 429 on the 11th.
8. Concurrency test against the unique constraint: simulate Redis miss; DB unique index still prevents double credit.

**Non-negotiables**

- Idempotency is enforced in two layers (Redis + DB unique constraint). Both must exist.
- Competition and spendable ledgers are never updated by the same SQL statement in a way that conflates them.
- Leaderboard never exposes real names — alias only.

---

### Phase 6 — Rewards, redemption, William reconciliation (Day 10–11, 21–22 May)

**Goal.** The catalog works for self-service and staff-assisted redemption. William's premium reward only completes on confirmed Calendly booking.

**Build**

- Reward catalog (`rewards`: cost, inventory, per_attendee_limit, type, expiry, lock_until, redemption_policy).
- Self-service redemption: `POST /rpc/rewards.redeem` with idempotency key.
- Staff redemption: staff scans attendee profile QR → selects reward → confirms.
- Admin reversal with mandatory `reason`.
- William reward: special row with `external_provider='calendly'`. Points held but not deducted until Calendly webhook confirms booking.
- Calendly webhook `/api/webhooks/calendly/[eventSlug]` validates HMAC, matches invitee email to attendee, deducts points, completes redemption.

**How**

- Redemption transaction: `BEGIN; SELECT ... FROM rewards WHERE id=? FOR UPDATE; ...; COMMIT;` so concurrent redemptions cannot oversell the last unit.
- Per-attendee limit enforced by a partial unique index and a count check in the same transaction.
- William flow has two states: `pending_booking` (when attendee clicks "claim", spendable balance is NOT deducted, but a `redemption_holds` row is created) and `completed` (on Calendly webhook). If the webhook fails after N retries, a Cloud Tasks reconciler queries Calendly's API every 5 min for the next 24 h, then alerts the admin.
- The reconciler is idempotent by `(attendee_id, reward_id, calendly_event_id)`.

**Test gate**

1. Parallel redemption of the last inventory unit by 50 attendees: exactly one succeeds, 49 receive a clean "sold out" response.
2. Insufficient `spendable_balance` returns 400 and disables the button client-side.
3. Per-attendee limit (e.g. 2 of reward X) is enforced even on parallel calls.
4. Admin reversal requires both `admin` role and a non-empty `reason`; the reversal restores inventory and balance, with an `audit_logs` entry.
5. William happy path: attendee claims → Calendly webhook → points deducted, redemption `completed`, audit row written.
6. William webhook idempotency: replaying the same Calendly payload does not deduct twice.
7. William reconciliation: simulate a missed webhook; the reconciler closes the redemption within its retry window.

**Non-negotiables**

- Inventory mutation is atomic with redemption record creation.
- William points are deducted only after confirmed booking.
- Spendable balance can never go negative — DB CHECK constraint.

---

### Phase 7 — Notifications + ops dashboard (Day 11, 22 May)

**Goal.** Admin can broadcast immediate and scheduled in-app notifications. Live ops dashboard shows real-time event-day state with graceful degradation.

**Build**

- `notifications` table (title, body, scheduled_at, audience, created_by, delivery_log jsonb).
- Immediate broadcast → fan-out via Cloud Tasks queue → workers write per-attendee `notification_recipients` rows.
- Scheduled broadcasts: Cloud Scheduler polls every minute; due rows are enqueued.
- Attendee UI polls `/api/notifications/feed` every 30 s (TanStack Query, stale-while-revalidate).
- Ops dashboard at `/admin/ops` with: check-ins, scans/minute (last 5 min), low-stock rewards, top-rank movement, recent audit entries.

**How**

- The ops dashboard reads from a small set of read-only views (`vw_ops_*`) refreshed by short SQL queries; it gracefully shows "stale" if a view returns older-than-30s data, instead of erroring.
- Notification delivery log captures actor attribution (`created_by_user_id`) and per-recipient delivery status.
- We deliberately do not use browser push or websockets in v1.

**Test gate**

1. Immediate broadcast lands in all targeted attendees' feeds within 30 s.
2. Scheduled broadcast fires inside its configured minute window (±30 s).
3. Notification log captures the actor, audience scope, and per-recipient status.
4. Ops dashboard numbers reconcile to underlying tables for a 60-s window sample.
5. Dashboard degrades gracefully: kill one read-only view in test; the dashboard shows "stale" for that widget, not a 500.

**Non-negotiables**

- Every notification send is attributable to an admin/staff actor.
- Dashboard partial-failure must not break the page.

---

### Phase 8 — Reporting, exports, archive (Day 11–12, 22–23 May)

**Goal.** Admin can export everything that matters at any time, always reflecting the latest data. Archive mode enforces 10-day attendee access with admin reopens.

**Build**

- CSV / JSON exports for: attendees, businesses, scans, point awards, redemptions, sponsor leads (consent-filtered), notifications, leaderboard final.
- Export jobs run synchronously for small datasets and via Cloud Tasks for large ones; result PDFs/CSVs stored in `gs://salesgeek-prd-exports/...` with `as_of` metadata.
- Archive transition middleware: when `event.lifecycle_state='post_event_archive'`, all mutating routes return 403 except admin paths.
- 10-day attendee access: derived from `event.ended_at + interval '10 days'`. Cloud Scheduler daily job expires sessions beyond this window.
- Admin reopen control for individual attendees (writes an `access_overrides` row + audit entry).

**How**

- Exports stream rows out of Postgres (`COPY (SELECT ...) TO STDOUT WITH CSV HEADER`) into the response writer to keep memory flat regardless of dataset size.
- Sponsor lead export joins `sponsor_interest` on `consented = true` at the SQL level.
- The archive cutoff is enforced server-side in middleware; UI gating is decorative.

**Test gate**

1. Sponsor X lead export contains only consenting attendees; mutating consent flips presence in the next export.
2. Archive transition blocks `/scan/*` and `/rewards/*` mutations with 403, allows profile view.
3. Day-11 simulation: attendee session is invalidated; admin reopen restores access for that attendee specifically.
4. Final leaderboard is visible only to authenticated attendees during the 10-day window.
5. Real-time export: a scan written 2 s before export request appears in the resulting CSV.
6. Export `as_of` timestamp matches the export trigger time within an SLA of 30 s.

**Non-negotiables**

- Non-consenting data is never in a sponsor export, full stop.
- Archive policies are enforced server-side, never UI-only.

---

### Phase 9 — Hardening, load, security, UAT (Day 12–13, 23–24 May)

**Goal.** The platform survives a synthetic 3x peak load; security checks have no unresolved high-severity issues; staging UAT passes end-to-end.

**Build**

- k6 load tests targeting staging:
  - 500 attendees signing up over 10 min (with email delivery against a test Resend inbox)
  - 1,000 scans/min sustained for 5 min on a mix of QR types
  - 100 simultaneous redemptions on a 10-unit reward
  - 2,000 leaderboard reads/min
- OWASP-focused checks on auth, scan, redeem, export, webhook endpoints (manual + automated via `zap-baseline`).
- Staging dry-run from signup through archive toggle, with the actual ops team as testers.
- Runbooks:
  - OTP not arriving
  - Scan returning 500
  - Leaderboard cache stale
  - Reward dispute
  - Archive reopen
  - Calendly webhook lag

**How**

- k6 scripts live in `tests/load/`; they target staging with a synthetic data set seeded by `pnpm seed:load`.
- Sentry release tracking is wired; release health metrics are reviewed each day.
- Cloud Armor rate-limit rules are validated by a deliberately abusive k6 script that should be 429'd.

**Test gate**

1. p95 latency on `/scan/*` < 400 ms at 1,000 scans/min sustained.
2. p95 latency on leaderboard read < 200 ms at 2,000 reads/min sustained.
3. Idempotency holds under load: 50,000 retry scans, zero double-credits.
4. No high-severity ZAP findings remain open.
5. Staging dry-run signed off with all P0 paths green.
6. Every runbook tested by playing back its triggering condition in staging.

**Non-negotiables**

- No production go-live with any unresolved P0 from load/security/UAT.
- A named incident owner and on-call rotation are documented before launch.

---

### Phase 10 — Production launch & event-day operations (24–26 May)

**Goal.** Production is live, monitored, and supported.

**Build**

- Tagged release deployed to production via Cloud Build (manual approval gate).
- Production smoke suite (signup, OTP, scan, redeem, leaderboard, admin login, export).
- Live monitoring rota and incident command:
  - On-call engineer (primary)
  - Backup engineer
  - Ops lead (non-engineer)
- Feature flags pre-set for "calm-down" mode (hot-disable QR scoring, leaderboard, rewards individually).

**Test gate**

1. Smoke suite passes against production after deployment, before doors open.
2. Cloud Monitoring dashboard matches Postgres counts within ±1% for first hour.
3. Alerting paths verified end-to-end (paging on-call from a synthetic error).

**Non-negotiables**

- 48-hour pre-event change freeze, broken only for incident fixes.
- Every critical alert pages a human.

---

### Phase 11 — Archive, analytics, handover (27 May – 5 June)

**Goal.** Event is captured, analyzed, handed over.

**Build**

- Archive transition executed at agreed time after event close.
- Sponsor lead export pack (per sponsor, consent-filtered).
- Post-event analytics package (engagement, top QRs, top rewards, funnel drop-off).
- Backup/restore drill: restore last night's snapshot into a scratch project, verify data integrity.
- Handover artifact bundle: code, infra Terraform, runbooks, credentials rotation log.

**Test gate**

1. 10-day attendee access expires correctly on 5 June.
2. Restored backup matches the source's row counts and key sums.
3. Final acceptance checklist is signed by the project lead.

---

## Part 3 — Deployment

This section is the actual deployment manual. It walks through local-first testing, then a clean staging deploy on GCP, then production scaling for event day.

### 3.1 Local development (test everything here first)

**Prerequisites:**

- Node.js 20, pnpm 9
- Docker Desktop or OrbStack
- `gcloud` CLI authenticated (`gcloud auth application-default login`)
- `psql` for poking the local DB

**Local stack:**

```yaml
# infra/docker/docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: salesgeek
      POSTGRES_PASSWORD: salesgeek
      POSTGRES_DB: salesgeek
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]
volumes:
  pgdata:
```

**Bring-up:**

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
cp .env.example .env.local
pnpm db:migrate           # prisma migrate dev
pnpm db:seed              # seed sample event, geeks, sponsors, rewards, QRs
pnpm dev                  # apps/web on :3000
pnpm dev:worker           # apps/worker
```

The `.env.local` points Resend to MailHog via an internal flag (`EMAIL_TRANSPORT=mailhog`) — no real emails are sent locally.

**What to test locally before opening a PR:**

1. `pnpm test` — Vitest unit + integration suites.
2. `pnpm test:e2e` — Playwright against `pnpm dev` (boots browser, runs the five critical journeys).
3. Manual smoke on `http://localhost:3000/sge-2026`:
   - Signup → OTP (from MailHog UI on `:8025`) → verify → home tab populates.
   - Scan a seeded QR (`/sge-2026/scan/SEED-SPONSOR-01`) → score updates.
   - Refresh the same scan → "already collected".
   - Redeem a seeded reward → balance drops, inventory decrements.
   - Toggle a feature flag in admin → behavior changes without restart.

**Local CI parity:** the CI pipeline (`.github/workflows/ci.yml`) runs the same `pnpm typecheck && pnpm lint && pnpm test` so PRs cannot pass CI without passing locally first.

### 3.2 GCP project bootstrap (one-time per env)

```bash
# variables
PROJECT_ID=salesgeek-stg     # or salesgeek-prd for production
REGION=europe-west2          # London

gcloud projects create $PROJECT_ID --name="SalesGeek Staging"
gcloud billing projects link $PROJECT_ID --billing-account=<ACCOUNT_ID>
gcloud config set project $PROJECT_ID

# enable APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  errorreporting.googleapis.com \
  vpcaccess.googleapis.com

# artifact registry for container images
gcloud artifacts repositories create salesgeek \
  --repository-format=docker --location=$REGION

# VPC connector so Cloud Run can reach Cloud SQL and Memorystore on private IPs
gcloud compute networks vpc-access connectors create salesgeek-conn \
  --region=$REGION --range=10.8.0.0/28 --network=default
```

All of the above should be checked into `infra/terraform/` as Terraform code; the commands here are the equivalent for clarity. Terraform is the source of truth in the repo.

### 3.3 Cloud SQL — Postgres setup

```bash
gcloud sql instances create salesgeek-pg \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=$REGION \
  --availability-type=REGIONAL \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --network=default \
  --no-assign-ip

gcloud sql databases create salesgeek --instance=salesgeek-pg
gcloud sql users create salesgeek_app --instance=salesgeek-pg --password=<from-secret-manager>
```

**Key flags explained:**

- `--availability-type=REGIONAL` — synchronous standby in another zone, automatic failover.
- `--enable-point-in-time-recovery` — required for restore drills.
- `--no-assign-ip` — DB has no public IP. Cloud Run reaches it through the VPC connector + Cloud SQL Auth Proxy sidecar.
- Backups daily at 03:00, retained 7 days; pre-event we manually take an extra snapshot at T-24h.

### 3.4 Memorystore — Redis setup

```bash
gcloud redis instances create salesgeek-redis \
  --size=5 --region=$REGION --tier=standard \
  --redis-version=redis_7_0 \
  --network=default \
  --connect-mode=PRIVATE_SERVICE_ACCESS
```

Standard tier gives us a replica and automatic failover. The 5 GB is wildly over what we need for 1,000 users (we use ~150 MB), but it is the smallest Standard tier and the marginal cost matters less than the reliability.

### 3.5 Cloud Storage buckets

```bash
gsutil mb -l $REGION gs://$PROJECT_ID-assets       # sponsor logos, photos
gsutil mb -l $REGION gs://$PROJECT_ID-qr-assets    # QR pngs, print exports
gsutil mb -l $REGION gs://$PROJECT_ID-exports      # admin CSV/JSON exports

# lifecycle: exports auto-delete after 90 days
gsutil lifecycle set infra/gcs/exports-lifecycle.json gs://$PROJECT_ID-exports
```

Public reads on `-assets` (for sponsor logos in attendee pages) are not needed because we serve them through Next.js `<Image>` with the bucket as the loader; the bucket is private + signed URLs.

### 3.6 Secret Manager — environment

Every secret is a Secret Manager resource. Cloud Run reads them at boot via the `--update-secrets` flag.

Required secrets (per env):

```
DATABASE_URL              postgres://salesgeek_app:***@/salesgeek?host=/cloudsql/<conn>
REDIS_URL                 redis://10.x.x.x:6379
SESSION_SECRET            <32-byte random>
QR_SIGNING_SECRET         <32-byte random>
RESEND_API_KEY            <from Resend>
CALENDLY_WEBHOOK_SECRET   <from Calendly>
SENTRY_DSN                <from Sentry>
POSTHOG_KEY               <from PostHog>
```

```bash
echo -n "<value>" | gcloud secrets create SESSION_SECRET --data-file=- --replication-policy=automatic
# rotate:
echo -n "<new>" | gcloud secrets versions add SESSION_SECRET --data-file=-
```

The Cloud Run service identity (a dedicated service account `web-run@$PROJECT_ID.iam.gserviceaccount.com`) is granted `roles/secretmanager.secretAccessor` only on the secrets it needs.

### 3.7 Cloud Run — web service

```bash
gcloud run deploy web \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/salesgeek/web:<sha> \
  --region=$REGION \
  --service-account=web-run@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=salesgeek-conn --vpc-egress=private-ranges-only \
  --add-cloudsql-instances=$PROJECT_ID:$REGION:salesgeek-pg \
  --set-env-vars=NODE_ENV=production \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,... \
  --min-instances=2 --max-instances=20 \
  --cpu=1 --memory=1Gi --concurrency=80 \
  --timeout=60s --no-allow-unauthenticated
```

**Notes for the 1k/day target:**

- `--min-instances=2` only during event week (cost). We can scale to 0 the rest of the time. Set with a Cloud Scheduler job that flips the min instances at T-24h.
- `--concurrency=80` — Next.js handles this well on 1 vCPU because most routes are I/O bound.
- `--cpu-boost` on first request only.
- `--no-allow-unauthenticated` — the LB sits in front, signed requests only.

Worker service is identical but `--min-instances=1 --max-instances=5 --concurrency=20`, and exposes a `/jobs/*` interface that Cloud Tasks and Cloud Scheduler call.

### 3.8 Cloud Load Balancer + Cloud CDN + Cloud Armor

```
[Cloudflare]
    ↓ TLS to GCP cert
[Global External HTTPS LB]
  - backend: Cloud Run serverless NEG (web)
  - Cloud CDN: ON for /_next/static/*, /assets/*, /og/*
  - Cloud Armor policy:
      - rate limit: 60 req/min/IP on /scan/*
      - rate limit: 10 req/min/IP on /api/auth/otp
      - bot detection: block known bad UAs
      - WAF preset: OWASP CRS, paranoia 1
```

Custom domain: `app.salesgeek.scot` → Cloudflare → GCP LB. TLS via managed cert.

### 3.9 Cloud Tasks + Cloud Scheduler

Cloud Tasks queues:

- `notifications-fanout` — per-attendee notification writes
- `william-reconciliation` — periodic Calendly reconciliation
- `email-retry` — failed transactional emails
- `exports-heavy` — large CSV generation

Cloud Scheduler jobs:

- `* * * * *` poll `notifications-due`
- `0 3 * * *` daily archive transition check, reward expiry, backup verification
- `*/5 * * * *` Calendly reconciliation kick

All scheduler targets are authenticated HTTP calls to the worker service with an OIDC token.

### 3.10 CI/CD — GitHub Actions + Cloud Build

```
GitHub PR opened
  ↓
GitHub Actions: lint + typecheck + vitest + prisma drift check
  ↓ (on merge to `staging` branch)
Cloud Build: build image, push to Artifact Registry, deploy to staging Cloud Run
  ↓ (manual approval on a tagged release)
Cloud Build: deploy to production Cloud Run, run prisma migrate deploy, run smoke suite
```

`cloudbuild.yaml` highlights:

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build','-f','infra/docker/web.Dockerfile','-t','...:$SHORT_SHA','.']
  - name: gcr.io/cloud-builders/docker
    args: ['push','...:$SHORT_SHA']
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: bash
    args:
      - -c
      - |
        gcloud sql connect salesgeek-pg --user=salesgeek_app < /workspace/migrations.sql || \
        ./infra/scripts/migrate-via-job.sh
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    args: ['run','deploy','web','--image','...:$SHORT_SHA',...]
```

Production deploys are gated by:

- Manual approval in Cloud Build
- All GitHub status checks green on the SHA
- `staging` smoke suite green on the same SHA in the last 24 h

### 3.11 Scalable deployment plan for the 1,000-user/day event

The target is not raw throughput; it is **predictable availability during 90 minutes of bursty load**. The configuration below is what we set at T-24h.

**Cloud Run (web):**

- `min-instances=4` (warm pool covers cold start at gates)
- `max-instances=30`
- `cpu-boost=true`
- `concurrency=80`

**Cloud Run (worker):**

- `min-instances=2`, `max-instances=10`

**Cloud SQL:**

- Tier stays at `db-custom-2-7680`; we verified in load tests that this handles 3x peak.
- A read replica is provisioned for leaderboard / dashboard reads (`--replica-type=READ`).
- Connection limit at the DB is set to 200; PgBouncer in front pools to 30 server-side conns.

**Memorystore:**

- Standard tier, already 5 GB, no resize needed.

**Cloud Armor:**

- Tighten `/scan/*` rate limit to 40 req/min/IP (one scan every 1.5 s is generous; humans are slower).
- Geo-block non-UK on the auth endpoints unless an exemption header is present (the on-call can disable instantly).

**Scaling triggers (Cloud Monitoring alerts):**

- p95 latency on `/scan/*` > 800 ms for 2 min → page on-call
- Cloud SQL CPU > 75% for 5 min → page on-call
- Memorystore memory > 70% → page on-call
- 5xx rate > 1% on any route for 2 min → page on-call
- Cloud Run instance count > 25 for 10 min → page on-call (likely an abuse pattern)

**Capacity envelope (validated in Phase 9 load test):**

| Surface | Sustainable | Peak handled | Notes |
|---|---|---|---|
| QR scan award | 200 RPS | 500 RPS burst | Cloud Run instances ramp in ~15 s |
| Leaderboard read | 1,000 RPS | 3,000 RPS burst | 30-s Redis cache absorbs most |
| OTP issuance | 30 RPS | 80 RPS burst | Resend ratelimit is the ceiling |
| Reward redeem | 100 RPS | 250 RPS burst | Row-locking is the bottleneck |

These exceed our target by 3–5x.

### 3.12 Cost envelope (for event week)

| Item | Approx event-week cost |
|---|---|
| Cloud Run (min=4 for 7 days, ~30 instance-hours/day peak) | £30–£50 |
| Cloud SQL HA `db-custom-2-7680` | £180/month → ~£45/week |
| Memorystore 5 GB Standard | £130/month → ~£30/week |
| Cloud Storage + egress | ~£5 |
| Networking + LB + CDN | ~£20 |
| Cloud Build minutes | ~£5 |
| **Total event week** | **~£135–£170 (well inside credits)** |

Off-peak (rest of year) cost is roughly £30–£50/month with min=0 and the DB tier scaled down.

### 3.13 Pre-event freeze and event-day runbook

**T-48h (Sun 24 May):**

- Production change freeze begins; only incident fixes deploy.
- Full backup taken; restore drill executed in scratch project.
- All env secrets confirmed present and correct in Secret Manager.
- Cloud Armor rules reviewed.
- Resend deliverability dashboard reviewed; OTP test from a real `@gmail`, `@outlook`, `@icloud` account.

**T-24h (Mon 25 May):**

- `min-instances` raised to 4 (web) / 2 (worker).
- Read replica provisioned and validated.
- Synthetic monitors on: signup, OTP verify, scan, leaderboard, redeem, admin login.
- Feature flags pre-loaded with default-on state; "calm-down" switches verified.
- On-call rota published; incident command rehearsal.

**T-2h (Tue 26 May, 06:30):**

- Production smoke suite run.
- Dashboard left up on the ops table.
- PagerDuty / Slack alert routing confirmed.

**During event:**

- On-call watches dashboards; every alert pages.
- Any code change requires explicit approval from the technical lead.
- Feature flag flips are the preferred remediation, not redeploys.

**T+0 to T+10 days:**

- Daily review of attendee access (per archive policy).
- Sponsor export packs delivered (consent-filtered).
- Backup/restore drill on day 5.

### 3.14 Disaster recovery

| Scenario | Mitigation | RTO | RPO |
|---|---|---|---|
| Cloud Run region outage | Manual redeploy to backup region (`europe-west1`) using same image | 30 min | 0 (DB unaffected) |
| Cloud SQL primary failure | Automatic failover to regional standby | < 5 min | < 5 s |
| Cloud SQL data corruption | Point-in-time restore from backup | 30 min | 5 min |
| Memorystore failure | Failover to replica; in-app idempotency tolerates a brief Redis outage (DB unique constraints are the second line of defence) | < 5 min | n/a |
| Total project compromise | Restore from cross-project backup into `salesgeek-dr` project | 2 h | 24 h |

### 3.15 Production readiness checklist (gate to go-live)

**Infrastructure**

- [ ] Cloud SQL HA + PITR enabled, restore drill passed
- [ ] Memorystore Standard tier provisioned
- [ ] Cloud Run web + worker deployed, min-instances raised
- [ ] VPC connector + private IPs verified
- [ ] Artifact Registry images scanned, no critical CVEs
- [ ] Custom domain + Cloudflare + GCP managed cert active
- [ ] Cloud Armor rules active and tested

**Security**

- [ ] All secrets in Secret Manager, none in repo or env files
- [ ] Service accounts use least privilege
- [ ] SPF / DKIM / DMARC live on sending domain
- [ ] Penetration check against staging clean
- [ ] HTTPS-only, secure cookies, `__Host-` prefix
- [ ] HMAC validation on `/scan/*` and Calendly webhook

**Platform**

- [ ] Phase 0–9 test gates green
- [ ] Staging dry-run signed off
- [ ] Synthetic monitors active for the five critical journeys
- [ ] Feature flags set and verified

**Operations**

- [ ] On-call rota published
- [ ] Runbooks reviewed
- [ ] Slack/PagerDuty alert routing tested end-to-end
- [ ] Pre-event freeze in effect
- [ ] Backup taken at T-24h

---

## Appendix A — Phase calendar at a glance

| Day | Date | Phase | Owner gate |
|---|---|---|---|
| 1 | Tue 12 May | Phase 0 | Repo + CI green |
| 2 | Wed 13 May | Phase 1 | Event slug routing + lifecycle |
| 3 | Thu 14 May | Phase 2 | OTP + check-in |
| 4–6 | Fri 15 – Sun 17 May | Phase 3 | Five-tab IA + content |
| 6–7 | Sun 17 – Mon 18 May | Phase 4 | Business QR |
| 7–10 | Mon 18 – Thu 21 May | Phase 5 | Scoring + leaderboard |
| 10–11 | Thu 21 – Fri 22 May | Phase 6 | Rewards + William |
| 11 | Fri 22 May | Phase 7 | Notifications + ops |
| 11–12 | Fri 22 – Sat 23 May | Phase 8 | Exports + archive |
| 12–13 | Sat 23 – Sun 24 May | Phase 9 | Load + security |
| 14 | Mon 25 May | Phase 10 | Production cutover |
| 15 | Tue 26 May | — | **Event day** |
| 16–25 | Wed 27 May – Fri 5 Jun | Phase 11 | Archive + handover |

## Appendix B — Test pyramid

| Layer | Tool | Where |
|---|---|---|
| Unit | Vitest | `packages/domain/**/*.test.ts` |
| Integration | Vitest + ephemeral Postgres (testcontainers) | `packages/db/**/*.int.test.ts` |
| Contract | Vitest + Zod | `packages/contracts/**` |
| E2E | Playwright | `tests/e2e/**` |
| Load | k6 | `tests/load/**` |
| Security | ZAP baseline + manual | `tests/security/**` |

## Appendix C — Phase gate definition (reused from existing plan, GCP-aligned)

A phase is closed only when:

1. All listed P0 test cases pass in CI on the phase branch.
2. The phase's staging smoke pass is green for the same SHA.
3. Non-negotiables are signed off with evidence (test output, log link, or runbook entry).
4. No unresolved Sev-1 or Sev-2 defects within the phase boundary.

---

*End of GCP phased implementation plan.*
