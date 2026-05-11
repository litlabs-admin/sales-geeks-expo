# SalesGeek Expo Companion Platform - Implementation Phases

This document is the phase-wise delivery plan for taking the SalesGeek Scotland event companion web app from planning to live production for Scottish Growth Expo 2026.

It covers:

- what we build in each phase
- how we build it
- what must be tested before moving to the next phase
- how local testing, staging, production deployment, scaling, monitoring, and event-day operations should work

The source of truth for product scope remains [`../northstar.md`](../northstar.md). This file translates that scope into execution phases.

---

## 1. Delivery Objective

Ship a production-ready, mobile-first, multi-event companion platform for Scottish Growth Expo 2026 on 26 May 2026 at Hampden National Stadium, Glasgow.

The app must support:

- approximately 1,000 users in one event day
- expected real attendee size of 350-500, with capacity for overage, staff/admin use, and retry traffic
- short bursts of QR scans around registration, breaks, sponsor visits, and session changes
- poor venue connectivity, repeated retries, and duplicate scan submissions
- prize-critical auditability for scoring, rewards, redemptions, reversals, exports, and admin actions
- reuse for future events through event-scoped data and slug-based routing

The app must be built as an operational event product, not a marketing page.

---

## 2. Recommended Technical Baseline

Because GCP credits are available, the preferred production architecture should stay inside Google Cloud where practical.

### Application

- Next.js App Router web app
- TypeScript strict mode
- Tailwind CSS for UI
- Server Actions / Route Handlers for write flows
- Domain modules for scoring, rewards, identity, QR, sponsor consent, notifications, exports, and audit
- Dockerized deployment to Cloud Run

### Data and Infrastructure

- Cloud Run for the web app/API container
- Cloud SQL for PostgreSQL as source-of-truth relational database
- Memorystore for Redis or Valkey for idempotency keys, rate limits, OTP state, short-lived caches, and queues
- Cloud Storage for uploaded assets, QR print exports, sponsor logos, floorplans, and reports
- Secret Manager for production secrets
- Cloud Build or GitHub Actions for CI/CD
- Artifact Registry for container images
- Cloud Scheduler for scheduled jobs
- Cloud Tasks for reliable background task execution
- Cloud Logging, Cloud Monitoring, and Error Reporting for operations

### External Services

- Email provider: Resend, SendGrid, Mailgun, or equivalent transactional email provider
- Calendly webhook for William premium reward confirmation
- DNS provider: existing domain provider or Cloud DNS

### Why This Baseline Fits

- Cloud Run autoscales based on traffic and can keep warm instances for event day.
- Cloud SQL gives strong relational integrity for prize-critical data.
- Redis/Valkey handles short-lived idempotency and rate-limit state without overloading Postgres.
- Cloud Storage is simple and durable for files and exports.
- The architecture is simpler than Kubernetes and appropriate for a 1,000-user event-day load.

---

## 3. Launch Capacity Targets

These are the working targets for implementation and load testing.

| Area | Target |
|---|---|
| Event-day users | 1,000 total users/day |
| Expected attendees | 350-500 real attendees |
| Peak concurrent users | 150-250 |
| Burst QR scans | 50-100 scans/min sustained for short periods |
| API p95 latency | less than 500 ms for normal reads, less than 1,000 ms for writes |
| QR scan p95 latency | less than 1,000 ms including idempotency lookup and ledger write |
| Availability target on event day | 99.9% during event window |
| Duplicate scan tolerance | repeated identical scan requests must not double-award |
| Recovery point objective | less than 15 minutes for production database |
| Recovery time objective | less than 60 minutes for critical production restore |

Load tests should run at 2x the expected event-day peak before launch.

---

## 4. Global Build Rules

These rules apply to every phase.

- Every table containing event data must include `event_id`.
- Every event-scoped query must filter by `event_id`.
- Every scoring, scan, reward, redemption, OTP, webhook, export, and notification write must be idempotent or explicitly protected from duplicate execution.
- Email is the attendee's canonical identity.
- Attendee email is immutable after signup except admin correction.
- Business name is locked after signup except admin correction.
- Phone and real name are editable.
- Alias is auto-generated and can be edited once.
- Competition score and spendable balance are separate ledgers.
- Spending points must never reduce leaderboard rank.
- OTP is required for prize eligibility, not for app entry.
- Sponsor lead sharing requires separate explicit consent.
- Admin and staff must use individual accounts, not shared logins.
- Staff can execute operational workflows only; admin owns configuration, exports, reversals, adjustments, and lifecycle transitions.
- Every privileged write must create an audit log entry.
- No phase can close while P0 tests are failing.

---

## 5. Phase Gate Definition

A phase can move forward only when all of the following are true:

1. The phase deliverables are implemented.
2. Unit tests for changed domain behavior pass.
3. Integration tests for database, idempotency, auth, and permissions pass where relevant.
4. End-to-end tests for the phase's critical user journeys pass.
5. No unresolved Sev-1 or Sev-2 defects remain.
6. Migrations can run on a clean database.
7. Migrations can run against the previous phase's database state.
8. Staging smoke tests pass for the phase.
9. Audit logs exist for all sensitive write paths added in the phase.
10. Documentation/runbooks are updated when operational behavior changes.

---

## 6. Phase 0 - Project Foundation and Architecture

### What We Build

- Monorepo or single Next.js app structure, depending on chosen delivery speed.
- Core app shell.
- Local Docker Compose environment.
- PostgreSQL database schema foundation.
- Redis/Valkey local service.
- Shared validation/contracts.
- CI pipeline.
- Base event-scoped data model.
- Base RBAC model.
- Audit logging foundation.

### How We Build It

- Create the application with Next.js, TypeScript, Tailwind, ESLint, Prettier, and test tooling.
- Add local services:
  - Postgres
  - Redis/Valkey
  - optional local email preview service
- Add migration tooling.
- Create initial database tables:
  - `events`
  - `users`
  - `attendees`
  - `attendee_event_records`
  - `staff_accounts`
  - `admin_accounts`
  - `businesses`
  - `audit_logs`
- Create common service-layer patterns:
  - event context resolver
  - authenticated actor context
  - transaction wrapper
  - audit writer
  - domain error model
  - idempotency helper
- Add CI:
  - install
  - lint
  - typecheck
  - unit tests
  - migration validation

### Tests Required To Move On

- App boots locally.
- Database migrations run from empty state.
- Migration rollback or reset workflow is documented and tested locally.
- A protected write creates an audit log.
- Staff cannot call an admin-only test mutation.
- Event-scoped query helper refuses to run without event context.
- CI passes on a clean checkout.

### Phase Exit Evidence

- Local setup commands documented.
- CI green.
- Initial schema committed.
- Architecture README or comments explain domain module boundaries.

---

## 7. Phase 1 - Event Setup and Multi-Event Core

### What We Build

- Event creation and configuration.
- Event slug routing.
- Event lifecycle states:
  - pre-event
  - event-day
  - post-event archive
- Event branding configuration.
- Feature toggle structure.
- Admin-only lifecycle controls.

### How We Build It

- Implement route pattern such as `/{eventSlug}`.
- Resolve event from slug server-side on every event route.
- Store configurable event fields:
  - name
  - slug
  - venue
  - start/end timestamps
  - archive expiry timestamp
  - brand colors
  - logo/image references
  - lifecycle state
  - feature flags
- Build admin event setup screens.
- Add clone-event capability in the data model if not in UI yet.
- Add lifecycle transition service with explicit legal transitions.

### Tests Required To Move On

- Known event slug resolves correctly.
- Unknown event slug returns a controlled not-found state.
- Cross-event data access returns no records.
- Invalid lifecycle transitions are rejected.
- Only admin can change event lifecycle.
- Event branding renders per event.
- Feature toggles are event-specific.

### Phase Exit Evidence

- Admin can create/edit event configuration.
- Attendee shell loads for configured event slug.
- Event lifecycle transition tests pass.

---

## 8. Phase 2 - Identity, Registration, OTP, and Check-In

### What We Build

- QR-led attendee entry.
- Pre-registration and event-day registration flow.
- Email OTP verification.
- Pending access before OTP completion.
- Prize eligibility gating.
- Duplicate registration prevention by canonical email.
- Auto check-in on first event-day app entry.
- Staff/admin manual check-in override.
- Attendee profile QR.
- Attendee session persistence.

### How We Build It

- Create registration form:
  - real name
  - email
  - phone
  - business
  - terms consent
  - sponsor sharing consent, if collected at signup
- Normalize email before identity matching.
- Create attendee global identity plus event-specific attendee record.
- Issue OTP after registration.
- Hash OTP at rest and store expiry/attempt count.
- Allow app access while `otp_verified = false`.
- Gate prize eligibility and reward completion on verified state.
- Create session cookie with:
  - attendee id
  - event id
  - verified state
  - check-in state
- Auto-check-in when event lifecycle is event-day.
- Generate attendee profile QR for staff identification.

### Tests Required To Move On

- Signup creates attendee and attendee-event record.
- Same canonical email maps to existing attendee.
- OTP verify succeeds with valid code.
- OTP verify fails after expiry.
- OTP brute-force attempts are rate-limited.
- Attendee can enter app before OTP verification.
- Unverified attendee cannot claim prize-eligible actions.
- First event-day entry sets check-in once.
- Re-entry does not create duplicate check-ins.
- Staff override can check in attendee.
- Profile QR resolves to correct attendee in staff flow.

### Phase Exit Evidence

- End-to-end registration works locally and in staging.
- OTP email can be tested with local preview and staging provider.
- Identity rules are covered by tests.

---

## 9. Phase 3 - Attendee Information Experience

### What We Build

- Five-tab attendee navigation:
  - Home
  - Agenda
  - Geeks
  - Rewards
  - Leaderboard
- Secondary pages:
  - Sponsors
  - FAQs/Help
  - Profile
  - Terms/Privacy
- Home page live context.
- Agenda module.
- Geeks module.
- Sponsor pages.
- Searchable FAQs.
- Venue guidance placeholder/floorplan support.

### How We Build It

- Build mobile-first shell with persistent bottom navigation.
- Home should prioritize:
  - now session
  - up-next session
  - announcements
  - points/rank/progress summary
- Agenda supports:
  - chronological list
  - stage filter
  - category filter
  - type filter
  - session status
  - speaker/sponsor/location detail
- Geeks supports four host profiles:
  - photo
  - bio
  - contact link
  - calendar link
- Sponsor pages support:
  - sponsor profile
  - website link
  - location/zone
  - scan state
  - interest toggle
  - undo interest
  - consent-aware lead sharing
- FAQs support admin editing and attendee search.

### Tests Required To Move On

- Five-tab nav renders exactly as required.
- Sponsors, FAQs, Profile, and T&Cs are outside the five-tab structure.
- Agenda filters work independently and together.
- Agenda live status updates when admin changes session status.
- Home displays now/up-next correctly for fixed test times.
- Geeks tab renders four configured hosts.
- Sponsor interest toggle does not affect points.
- Undo interest removes active interest state.
- Lead export excludes attendees without sponsor sharing consent.
- FAQ search returns relevant results.

### Phase Exit Evidence

- Mobile viewport QA complete.
- No critical layout overlap on common mobile widths.
- Admin can edit core public content.

---

## 10. Phase 4 - QR System, Scoring Engine, and Leaderboard

### What We Build

- QR code creation and management.
- Signed QR URLs.
- Unified scan route.
- Auto-award on page load.
- QR types:
  - sponsor
  - session
  - hidden bonus
  - staff validated/predefined action
- Scan idempotency.
- Competition score ledger.
- Spendable balance ledger.
- Point award history.
- Hidden bonus reveal schedule and zone hints.
- Leaderboard top 10 plus own rank.
- Tie-break by earliest time reaching score.
- Prize deadline enforcement.

### How We Build It

- Create QR records with:
  - event id
  - type
  - name
  - points
  - active flag
  - visibility
  - owner type
  - owner id
  - reveal timestamp
  - active window
  - zone/hint
  - HMAC or signed code
- Implement scan processor as a transaction:
  - resolve QR
  - validate event
  - validate attendee/session
  - check active/reveal/window rules
  - enforce one-scan-per-attendee default
  - insert scan record
  - insert point award record
  - update competition ledger
  - update spendable ledger
  - update leaderboard projection
  - write audit entry
- Use Redis/Valkey idempotency keys for fast duplicate protection.
- Enforce unique database constraints as the final guard.
- Build leaderboard read model from source-of-truth ledgers.

### Tests Required To Move On

- Sponsor QR awards visible configured points.
- Session QR awards only inside active window.
- Hidden bonus QR cannot be claimed before reveal time.
- Hidden bonus point value is hidden until awarded.
- Repeat scan returns already-collected state and no extra points.
- Retry storm does not double-award.
- Competition and spendable ledgers both update on award.
- Spending ledger is not used for leaderboard rank.
- Tie-break ranks earliest score timestamp higher.
- Leaderboard shows aliases only.
- Top 10 plus own rank is returned correctly.
- Prize deadline stops scoring unless QR explicitly overrides.
- Signed QR tampering is rejected.

### Phase Exit Evidence

- QR scan flow is tested under retries.
- Leaderboard projection matches ledger source-of-truth.
- Print/export QR preview works for operations.

---

## 11. Phase 5 - Rewards, Redemptions, and William Premium Flow

### What We Build

- Rewards catalog.
- Reward states:
  - available
  - locked
  - sold out
  - redeemed
  - expired
- Self-service rewards.
- Staff-only rewards.
- Inventory enforcement.
- Per-attendee limits.
- Staff redemption tools.
- Admin reversal tools.
- William premium reward with Calendly confirmation.

### How We Build It

- Model rewards with:
  - event id
  - name
  - description
  - cost
  - type
  - self-service/staff-only classification
  - inventory
  - per-attendee limit
  - expiry
  - active state
- Implement redemption transaction:
  - validate attendee
  - validate OTP/prize eligibility where required
  - validate balance
  - validate reward state
  - validate inventory
  - insert redemption record
  - decrement inventory
  - deduct spendable balance
  - write audit entry
- For William reward:
  - attendee starts booking intent from reward
  - points are not deducted on intent
  - Calendly confirmation webhook completes redemption
  - completion deducts points and inventory in one transaction
  - webhook retries are idempotent
  - reconciliation job detects mismatches
- Add admin reversal:
  - requires admin role
  - requires reason
  - restores inventory/balance where appropriate
  - appends audit record

### Tests Required To Move On

- Locked rewards display but cannot be redeemed.
- Insufficient balance blocks redemption.
- Parallel redemption at inventory boundary cannot oversell.
- Per-attendee limit is enforced.
- Staff-only reward cannot be self-redeemed.
- Staff redemption requires staff role.
- Admin reversal requires admin role and reason.
- Reversal restores balance/inventory correctly.
- William reward does not deduct points before Calendly confirmation.
- William webhook completion deducts points exactly once.
- William webhook retry is idempotent.
- William reconciliation resolves transient callback failure safely.

### Phase Exit Evidence

- Reward engine has high-coverage tests.
- Staff redemption is usable on mobile/tablet.
- William flow has staging webhook test evidence.

---

## 12. Phase 6 - Notifications and Live Operations Dashboard

### What We Build

- In-app notification feed.
- Immediate notifications.
- Scheduled notifications.
- Notification logs.
- Event-day live ops dashboard.
- Staff tools:
  - attendee search
  - profile QR lookup
  - redemption
  - predefined point actions

### How We Build It

- Create notification tables:
  - notification
  - notification target
  - delivery log
  - read state
- Use Cloud Scheduler/Cloud Tasks or a worker endpoint for scheduled notifications.
- Build admin compose UI with broadcast-first targeting.
- Build attendee notification feed with unread count.
- Build ops dashboard read models:
  - check-ins
  - OTP verifications
  - scan volume
  - QR failures
  - leaderboard movement
  - sponsor interest count
  - reward redemptions
  - low inventory
  - export/job status
- Build dashboard auto-refresh with manual refresh fallback.

### Tests Required To Move On

- Immediate notification appears in attendee feed.
- Scheduled notification sends within configured window.
- Notification logs include actor, target, and status.
- Attendee read state persists.
- Staff cannot access admin configuration.
- Staff search finds attendee by name, email, phone, alias, and profile QR.
- Dashboard metrics reconcile with source tables for known fixture data.
- Dashboard handles partial metric failure without crashing.

### Phase Exit Evidence

- Ops dashboard can run during a simulated event.
- Notification scheduler is tested in staging.
- Staff tools are validated by end-to-end tests.

---

## 13. Phase 7 - Reporting, Exports, and Archive

### What We Build

- CSV/JSON exports.
- Export audit logs.
- Consent-aware sponsor lead exports.
- Attendee detail exports.
- Scan exports.
- Reward/redemption exports.
- Leaderboard exports.
- Notification exports.
- Archive mode.
- 10-day attendee archive access.
- Admin reopen controls.

### How We Build It

- Define export schemas and field dictionaries.
- Exports should read latest committed source-of-truth data at execution time.
- Large exports should run as jobs and include:
  - `as_of_timestamp`
  - triggering admin
  - filters used
  - file checksum
  - storage path
  - audit entry id
- Store generated export files in Cloud Storage with controlled access.
- Implement archive policy:
  - event lifecycle becomes post-event archive
  - logged-in attendees can access final leaderboard and own history for 10 days
  - public unauthenticated final leaderboard is not available
  - admin can reopen with audit trail

### Tests Required To Move On

- Export schemas match documented field order.
- Sponsor lead export excludes non-consented attendees.
- Export generated immediately after scan includes that scan.
- Export generated immediately after redemption includes that redemption.
- Export audit includes actor and timestamp.
- Archive transition changes attendee UI state.
- Final leaderboard is authenticated-only in archive.
- Attendee access expires exactly after the configured 10-day archive window.
- Admin reopen restores access and writes audit log.

### Phase Exit Evidence

- Export files are generated in staging.
- Archive behavior has time-boundary tests.
- Data dictionary is published for admin handover.

---

## 14. Phase 8 - Security, Hardening, Load Testing, and UAT

### What We Build

- Production hardening.
- Rate limits.
- Abuse protection.
- Load test suite.
- Security test pass.
- Full event rehearsal.
- Incident runbooks.
- Pre-flight checklist.

### How We Build It

- Add rate limits for:
  - OTP issue
  - OTP verify
  - QR scan
  - sponsor interest toggle
  - reward redemption
  - admin login
  - export generation
- Add security controls:
  - secure cookies
  - CSRF protection where needed
  - strict admin/staff RBAC
  - webhook signature verification
  - audit logging
  - input validation
  - file upload restrictions
- Run load tests against staging:
  - registration burst
  - OTP verification burst
  - QR scan burst
  - leaderboard refresh burst
  - reward redemption burst
  - admin dashboard polling
- Run full UAT:
  - pre-event signup
  - event-day entry
  - OTP
  - auto check-in
  - sponsor scan
  - session scan
  - hidden bonus scan
  - leaderboard
  - reward redemption
  - staff search
  - export
  - archive transition

### Tests Required To Move On

- No unresolved high-severity security findings.
- Load test passes at 2x expected peak.
- QR idempotency holds under repeated concurrent submissions.
- Reward inventory holds under concurrent redemption.
- Admin/staff access cannot be bypassed.
- Webhooks reject invalid signatures.
- Production backup restore drill succeeds in a non-production environment.
- UAT sign-off is recorded.

### Phase Exit Evidence

- Load test report.
- Security checklist.
- UAT issue log and closure notes.
- Incident runbook.
- Event-day support rota.

---

## 15. Phase 9 - Production Launch and Event-Day Operations

### What We Build

This phase is primarily operational. The product should already be built.

### How We Launch

- Freeze non-critical changes before event day.
- Promote tested staging build to production.
- Run production smoke tests.
- Confirm monitoring and alerting.
- Confirm email delivery.
- Confirm QR links resolve.
- Confirm staff/admin access.
- Confirm export access.
- Confirm backup schedule.
- Put named people on:
  - incident owner
  - technical support
  - admin operator
  - staff escalation
  - client decision-maker

### Event-Day Operating Rules

- Avoid non-critical deployments during peak windows.
- Keep feature flags ready to disable:
  - hidden bonus QRs
  - reward redemption
  - notifications
  - leaderboard refresh frequency
  - non-critical sponsor pages
- Use ops dashboard for live monitoring.
- Track incidents in a simple issue log with timestamp, owner, impact, action, and resolution.
- Run manual backup/export snapshots at agreed checkpoints if required.

### Tests Required During Launch

- Production homepage loads.
- Event slug resolves.
- Attendee signup works.
- OTP email arrives.
- QR scan awards once.
- Repeat scan does not double-award.
- Leaderboard updates.
- Staff can search attendee.
- Staff can redeem reward.
- Admin can export current data.
- Monitoring alert route reaches the on-call owner.

### Phase Exit Evidence

- Production smoke checklist complete.
- Event-day issue log complete.
- Any hotfixes documented.

---

## 16. Phase 10 - Post-Event Archive, Reporting, and Handover

### What We Build

- Final archive state.
- Final exports.
- Sponsor reporting pack.
- Internal operations report.
- Handover package.
- Backup/restore validation.

### How We Build It

- Transition event to post-event archive.
- Verify logged-in attendee archive access.
- Generate final exports:
  - attendee list
  - check-ins
  - leaderboard
  - scan history
  - sponsor scan/interest leads
  - rewards/redemptions
  - notifications
  - audit summary
- Validate sponsor consent filtering before sharing leads.
- Confirm attendee archive access expiry after 10 days.
- Document:
  - production architecture
  - admin guide
  - staff guide
  - event clone guide
  - backup/restore guide
  - known limitations
  - future recommendations

### Tests Required To Close Project

- Archive access works for logged-in attendees.
- Archive access expires on configured cutoff.
- Final leaderboard is not public.
- Sponsor export contains only consented attendees.
- Backup restore reproduces expected database state.
- Handover documents are complete.

### Phase Exit Evidence

- Final export pack delivered.
- Handover pack delivered.
- Client acceptance recorded.

---

## 17. Deployment Plan

This section defines how we test locally first, then deploy safely and scale the app.

### 17.1 Local Development

Run everything locally before staging.

Local services:

- Next.js app
- Postgres
- Redis/Valkey
- local email preview or sandbox email provider
- optional webhook tunnel for Calendly testing

Required local commands should exist:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

Local test data should include:

- one event: Scottish Growth Expo 2026
- one admin
- two staff users
- at least 25 attendees
- four Geeks
- sample agenda
- sample sponsors
- sponsor/session/hidden QR codes
- sample rewards including William premium reward

Local acceptance before staging:

- registration works
- OTP can be tested
- QR scan works
- idempotency works
- leaderboard works
- reward redemption works
- staff search works
- admin exports work
- no P0 console/server errors

### 17.2 Staging Environment

Staging must be production-like but isolated.

Staging should have:

- separate Cloud Run service
- separate Cloud SQL database
- separate Redis/Valkey instance or namespace
- separate Cloud Storage bucket
- separate secrets
- test email domain or sandbox mode
- test Calendly webhook
- staging event slug

Staging use:

- QA
- client UAT
- load testing
- deployment rehearsal
- migration testing
- webhook testing
- backup/restore drill

No production data should be copied to staging unless it is scrubbed or explicitly approved.

### 17.3 Production Environment

Production should have:

- Cloud Run service in a region close to the audience, preferably `europe-west2` or another UK/Europe region selected for latency and service availability
- Cloud SQL PostgreSQL with automated backups and point-in-time recovery enabled
- Redis/Valkey for idempotency, cache, OTP/rate-limit state
- Cloud Storage buckets with least-privilege access
- Secret Manager for all secrets
- Cloud Scheduler and Cloud Tasks for scheduled/background jobs
- Cloud Logging and Monitoring dashboards
- uptime checks
- alerting to named people

### 17.4 Deployment Flow

Recommended flow:

1. Developer opens PR.
2. CI runs lint, typecheck, unit tests, integration tests, and migration checks.
3. Merge to main builds container image.
4. Container image is pushed to Artifact Registry.
5. Staging Cloud Run deploys automatically.
6. Staging smoke tests run.
7. Manual approval promotes the same image to production.
8. Production migrations run before or during deploy, depending on migration safety.
9. Production smoke tests run.
10. Deployment is recorded in release notes.

### 17.5 Migration Rules

- Prefer backward-compatible migrations.
- Add columns before code reads them.
- Backfill data before enforcing non-null constraints.
- Avoid destructive migrations during event week.
- Test migrations against staging data before production.
- Keep rollback plan for every production migration.
- Never run manual production SQL without recording the reason and result.

### 17.6 Cloud Run Scaling Configuration

Initial recommended Cloud Run settings for event day:

| Setting | Starting Point |
|---|---|
| Minimum instances | 1 normally, 2-3 during event hours |
| Maximum instances | 20-40 initially, tuned after load test |
| Concurrency | 40-80 requests per instance, tuned by latency |
| CPU | 1-2 vCPU |
| Memory | 512 MiB-1 GiB |
| Request timeout | keep short for normal APIs; longer only for exports/jobs |

Notes:

- Minimum instances reduce cold starts during the event.
- Maximum instances protect Cloud SQL from connection overload.
- Concurrency should be tuned with load tests, not guessed.
- Long-running jobs should run outside normal attendee request paths.

### 17.7 Database Scaling

Cloud SQL requirements:

- PostgreSQL
- automated backups
- point-in-time recovery
- private connectivity where feasible
- connection pooling
- SSL enforced
- indexes on event-scoped hot paths

Critical indexes:

- `attendee_event_records(event_id, attendee_id)`
- `attendees(email_normalized)`
- `scan_events(event_id, attendee_id, qr_code_id)`
- `point_awards(event_id, attendee_id, created_at)`
- `leaderboard_entries(event_id, score desc, reached_at asc)`
- `redemptions(event_id, attendee_id, reward_id)`
- `audit_logs(event_id, actor_id, created_at)`
- `sponsor_interests(event_id, sponsor_id, attendee_id)`

Database connection rules:

- Use connection pooling.
- Keep transactions short.
- Avoid doing email, webhooks, or file generation inside database transactions.
- Use unique constraints for final idempotency guarantees.
- Treat Redis idempotency as fast protection, not the only protection.

### 17.8 Cache and Idempotency Scaling

Redis/Valkey should be used for:

- OTP rate limits
- OTP attempt counters
- scan idempotency keys
- redemption idempotency keys
- webhook idempotency keys
- leaderboard short-cache
- notification scheduling support if not fully handled by Cloud Tasks

Key principles:

- All keys should include event id where relevant.
- All idempotency keys should have TTLs.
- Critical duplicate protection must also exist in Postgres unique constraints.
- If Redis is temporarily unavailable, prize-critical writes should fail safe rather than double-award.

### 17.9 Background Jobs

Use Cloud Scheduler for time-based triggers:

- scheduled notifications
- archive transition check
- reward expiry
- William reconciliation
- export cleanup

Use Cloud Tasks for reliable work:

- email sending
- export generation
- webhook follow-up processing
- notification delivery batches

Jobs must be:

- idempotent
- retry-safe
- logged
- observable
- linked to audit entries where sensitive

### 17.10 Monitoring and Alerts

Monitor:

- app error rate
- API latency
- QR scan success/failure rate
- duplicate scan rate
- OTP issue/verify failures
- email delivery failures
- database CPU/connections/locks
- Redis latency/errors
- Cloud Run instance count
- queue/task failures
- webhook failures
- export job failures

Event-day alert thresholds should be practical:

- QR scan error rate above agreed threshold for 5 minutes
- OTP email failures sustained for 5 minutes
- database connection exhaustion
- reward redemption failures
- app 5xx spike
- production uptime check failure

### 17.11 Security and Secrets

Secrets must live in Secret Manager, not in source control.

Required secrets:

- database URL
- Redis/Valkey connection
- session secret
- admin auth secret
- OTP/email provider API key
- Calendly webhook secret
- QR signing secret
- storage credentials if needed

Security requirements:

- secure HTTP-only cookies
- least-privilege service accounts
- strict CORS policy
- webhook signature verification
- audit logging for sensitive actions
- admin/staff RBAC enforced server-side
- export access restricted to admin
- production data never exposed through preview deployments

---

## 18. Cross-Phase Test Strategy

### Unit Tests

Cover deterministic domain logic:

- lifecycle transitions
- email normalization
- alias edit limit
- OTP state machine
- QR eligibility
- scoring ledger updates
- leaderboard ordering
- reward availability
- redemption eligibility
- consent filtering
- archive access rules

### Integration Tests

Cover infrastructure boundaries:

- database transactions
- unique constraints
- event scoping
- RBAC middleware
- Redis idempotency
- email adapter
- webhook adapter
- Cloud Storage export adapter
- scheduled job execution

### End-to-End Tests

Cover user workflows:

- attendee registration
- OTP verification
- event-day auto check-in
- sponsor QR scan
- session QR scan
- hidden bonus QR scan
- leaderboard view
- reward redemption
- William reward confirmation
- staff attendee search
- admin export
- archive transition

### Load Tests

Minimum required load scenarios:

- 1,000 attendee registrations over test window
- 250 concurrent users browsing Home/Agenda
- 100 QR scans/minute for 10 minutes
- duplicate scan retry storm
- leaderboard refresh under active scoring
- 50 concurrent reward redemption attempts on limited inventory
- admin dashboard polling during scan burst

### Manual UAT

Manual acceptance should be done on real mobile devices:

- iPhone Safari
- Android Chrome
- poor network simulation
- QR scan from printed paper
- QR scan from another phone screen
- staff search on phone/tablet
- admin dashboard on laptop

---

## 19. Capability Traceability

The final implementation must deliver all 20 stakeholder capabilities:

1. One event URL with pre-event, event-day, and archive modes.
2. QR-led desk entry.
3. Pre-registration continuity.
4. Email OTP passwordless identity.
5. Auto check-in with staff override.
6. Attendee Profile QR.
7. Home screen with live context, points, rank, and progress.
8. Agenda with filters and live status.
9. Geeks tab with four host profiles.
10. QR scanning game.
11. Time-released hidden bonus QRs.
12. Sponsor pages with interest and consent-gated sharing.
13. Rewards catalog with inventory and states.
14. William premium reward via Calendly confirmation.
15. Anonymous leaderboard.
16. In-app notifications.
17. Searchable FAQs/help.
18. Admin panel.
19. Live ops dashboard and staff tools.
20. Reporting, exports, and 10-day archive.

---

## 20. Open Inputs Needed Before Build Lock

These must be confirmed before final configuration and launch:

- final domain
- brand kit
- logo/assets
- event colors
- final agenda
- final speaker list
- four Geek profiles
- sponsor list
- sponsor logos/websites/locations
- reward catalog
- William Calendly details
- QR point values
- hidden bonus schedule and zones
- staff account list
- admin account list
- email sending domain
- legal terms/privacy/consent wording
- attendee CSV format
- venue floorplan or fallback directions
- client UAT owner
- event-day incident contacts

---

## 21. GCP Reference Notes

These implementation assumptions align with current Google Cloud documentation:

- Cloud Run automatically scales service revisions based on incoming requests, CPU utilization, concurrency, and configured min/max instances.
- Cloud Run maximum instances can be used to control costs and protect backing services such as databases.
- Cloud SQL for PostgreSQL supports automated backups and point-in-time recovery.
- Memorystore provides managed Redis/Valkey-compatible caching options suitable for rate limits, idempotency, and short-lived state.

Official references:

- Cloud Run autoscaling: https://cloud.google.com/run/docs/about-instance-autoscaling
- Cloud Run maximum instances: https://cloud.google.com/run/docs/configuring/max-instances
- Cloud SQL PostgreSQL PITR: https://cloud.google.com/sql/docs/postgres/backup-recovery/pitr
- Cloud SQL PITR configuration: https://cloud.google.com/sql/docs/postgres/backup-recovery/configure-pitr
- Memorystore: https://cloud.google.com/memorystore/docs
