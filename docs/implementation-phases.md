# SalesGeek Expo Companion Platform - Phase-wise Implementation Plan

## Delivery Objective
Ship a production-ready, multi-event companion platform for Scottish Growth Expo 2026 with deterministic scoring/reward behavior, auditability, and operational resilience for 5,000+ attendees and 500+ peak concurrent users.

## Global Rules (apply to every phase)
- No phase closes without all P0 tests passing in CI and staging smoke checks passing.
- No privileged write path is acceptable without RBAC and audit logging.
- No event-scoped table/query may operate without explicit `event_id` filters.
- No scoring or redemption write path may be non-idempotent.

---

## Phase 0 (May 12-13, 2026) - Foundation and Architecture Skeleton

### Deliverables
- Monorepo scaffold (`apps/web`, `packages/domain`, `packages/db`, `packages/contracts`, `packages/config`).
- Base Postgres schema and migration pipeline.
- RBAC primitives (`attendee`, `staff`, `admin`).
- Shared validation contracts and error model.
- Audit logger abstraction integrated into mutation service layer.

### Implementation Tasks
- Initialize pnpm + Turborepo workspace and CI workflows.
- Configure Supabase project bindings and env matrix (`local`, `staging`, `prod`).
- Create base entities: `events`, `users`, `attendees`, `staff_accounts`, `audit_logs`.
- Implement migration scripts and rollback verification commands.
- Introduce service-layer pattern for domain modules and a common transaction wrapper.

### Test Cases (Completion Criteria)
- CI runs `typecheck`, `lint`, `unit` on a minimal vertical slice.
- Migration up/down cycle passes on clean database.
- RBAC test verifies `staff` cannot execute admin-only mutation.
- Audit test verifies audit row is generated on a protected write.

### Non-negotiables
- Do not start feature modules until migration discipline is established.
- Do not expose any privileged mutation route without audit hook.

---

## Phase 1 (May 14-15, 2026) - Event Setup and Multi-Event Core

### Deliverables
- Event CRUD in admin.
- Event slug routing and middleware guard.
- Lifecycle state machine (`pre_event -> event_day -> post_event_archive`).
- Event branding and feature toggle configuration.

### Implementation Tasks
- Add `events` configuration schema (name, host brand, slug, lifecycle, theme tokens).
- Build admin screens for event creation/edit/clone and lifecycle transition.
- Implement event context resolver for every attendee/admin route.
- Add server-side guard that blocks access for invalid/inactive slug.

### Test Cases (Completion Criteria)
- Route test: `/{slug}` resolves only known configured event.
- Lifecycle transition tests enforce legal transitions and reject invalid jumps.
- Branding test verifies event-specific theme tokens render correctly.
- Data isolation test verifies cross-event fetch returns zero leakage.

### Non-negotiables
- Cross-event data leakage must be impossible by query design.
- Lifecycle transitions must be server-authorized only.

---

## Phase 2 (May 16-17, 2026) - Identity, Registration, Check-in

### Deliverables
- QR-led entry screen and attendee signup flow.
- Email OTP verification with pending-access behavior.
- Duplicate prevention by canonical email.
- Automatic event-day check-in on first qualified entry.

### Implementation Tasks
- Build prereg/event-day unified registration flow.
- Define immutable identity rules (email immutable except admin override).
- Implement pending-OTP app access with prize eligibility gating.
- Persist pre-signup scan context and replay post-registration.
- Add rate limits for OTP issue/verify endpoints.

### Test Cases (Completion Criteria)
- Pre-signup QR scan is preserved and awarded after signup.
- Duplicate registration by same canonical email maps to existing attendee.
- OTP brute-force protection test blocks repeated invalid attempts.
- Session continuity test validates repeated QR scans keep same attendee session.

### Non-negotiables
- Email immutability must be enforced at domain layer.
- Session continuity must hold under repeated entry/scan loops.

---

## Phase 3 (May 18-19, 2026) - Home, Agenda, Geeks, Sponsors

### Deliverables
- Five-tab attendee IA baseline with `Home`, `Agenda`, `Geeks`, `Rewards`, `Leaderboard` shell.
- Agenda and speaker/Geek/sponsor CRUD in admin.
- Personalized sponsor page with scan status and interest toggle.
- Live announcement feed in Home.

### Implementation Tasks
- Build home composition blocks (live now/up-next, announcements, score/rank snapshot).
- Implement agenda list/detail with status transitions.
- Create Geek profiles and sponsor content modules.
- Implement sponsor interest toggle with undo and independent consent model.
- Build consent-aware sponsor lead export shaping.

### Test Cases (Completion Criteria)
- Agenda status changes in admin are reflected in attendee UI.
- Sponsor interest toggle does not modify score/balance ledgers.
- Sponsor lead export excludes non-consented attendees.
- IA test verifies five-tab navigation and secondary pages separation.

### Non-negotiables
- Five-tab IA must remain consistent.
- Terms consent and sponsor consent must remain separate in storage and export behavior.

---

## Phase 4 (May 20-21, 2026) - QR Engine, Scoring, Leaderboard

### Deliverables
- Unified QR scan flow and typed QR behaviors.
- Idempotent scoring engine with transactional ledger writes.
- Session/reveal/time-window QR constraints.
- Leaderboard projection with deterministic tie-break logic.

### Implementation Tasks
- Implement QR payload signing + verification.
- Implement scan processor with idempotency key enforcement.
- Add QR type rules (`sponsor`, `session`, `hidden_bonus`, `staff_validated`).
- Create leaderboard read model sorted by score desc + reached_at asc.
- Add explicit user messaging states for already-collected/inactive/pre-reveal.

### Test Cases (Completion Criteria)
- Retry-storm test proves no double-credit under repeated identical scan submissions.
- Hidden bonus scan before reveal returns correct denial reason.
- Session QR outside active window is rejected.
- Tie-break test verifies earliest timestamp at same score ranks higher.

### Non-negotiables
- No non-idempotent scoring endpoint may exist.
- Competition and spendable ledgers must remain separate at all times.

---

## Phase 5 (May 22, 2026) - Rewards, Staff Redemption, William Reconciliation

### Deliverables
- Reward catalog with lock/availability/sold-out/redeemed/expired states.
- Staff redemption workflows and admin reversal workflows.
- Inventory and per-attendee limit enforcement.
- William premium flow with booking-confirmed completion and reconciliation.

### Implementation Tasks
- Model rewards with type, inventory, limits, expiry, and redemption policies.
- Build transactional redeem service updating redemption + inventory + balance.
- Implement admin reversal path requiring mandatory reason + audit.
- Build William booking confirm webhook handler + retry-safe reconciler.

### Test Cases (Completion Criteria)
- Parallel redemption boundary test prevents overselling at inventory limit.
- Reversal operation requires admin role and non-empty reason.
- William flow deducts points only after confirmed booking event.
- Reconciliation retry test resolves transient booking callback failures safely.

### Non-negotiables
- Inventory mutation and redemption state must be atomic.
- No silent failure path allowed for William reconciliation jobs.

---

## Phase 6 (May 23, 2026) - Notifications and Ops Dashboard

### Deliverables
- In-app immediate and scheduled notifications.
- Notification delivery logs and actor attribution.
- Event-day ops dashboard with auto-refresh + manual fallback.

### Implementation Tasks
- Add notification templates, scheduling table, queue dispatch workers.
- Build dashboard read models for check-ins, scans, interests, redemptions, top-rank movement.
- Implement fail-soft dashboard behavior if partial data sources lag.

### Test Cases (Completion Criteria)
- Scheduled notification executes at configured time window.
- Notification log includes actor, target scope, and delivery status.
- Dashboard metrics reconcile to source tables for a fixed interval sample.

### Non-negotiables
- Notification sends must always be attributable to an actor.
- Dashboard must degrade gracefully under partial outages.

---

## Phase 7 (May 24, 2026) - Reporting, Exports, Archive Controls

### Deliverables
- CSV/JSON exports for attendees, leads, leaderboard, scans, rewards, notifications.
- Archive transition controls and 10-day attendee access enforcement.
- Admin reopen controls with audit trail.

### Implementation Tasks
- Define export schemas and field dictionary.
- Implement consent and role-based export filtering.
- Implement archive window policy based on event end timestamp.
- Build reopen operations for attendee/event-level access exceptions.

### Test Cases (Completion Criteria)
- Archive cutoff test passes at exact boundary timestamp.
- Reopen action restores access as expected and creates audit entry.
- Final leaderboard remains attendee-authenticated only in archive mode.
- Export schema contract tests validate exact field set and ordering.

### Non-negotiables
- Export fields must match published data dictionary exactly.
- Archive policies must be enforced server-side, never UI-only.

---

## Phase 8 (May 25, 2026) - Hardening, Security, Load, UAT Rehearsal

### Deliverables
- Load test report and SLO validation.
- Security and abuse-hardening pass.
- End-to-end staging rehearsal runbook with issue log.

### Implementation Tasks
- Execute synthetic scan/redeem burst tests at 2-3x expected peak.
- Run OWASP-focused security checks on auth, scan, redeem, export endpoints.
- Execute staging dry-run from registration through archive toggle.
- Finalize runbooks: OTP issues, queue lag, reward disputes, archive reopen.

### Test Cases (Completion Criteria)
- p95 latency and idempotency SLO thresholds pass.
- Critical security checks pass with no unresolved high-severity issues.
- Staging full rehearsal signed off with all P0 paths passing.

### Non-negotiables
- No production launch without passing load/idempotency/audit integrity suites.
- No launch without named incident owner and support rota.

---

## Phase 9 (May 26, 2026) - Production Launch and Event-Day Operations

### Deliverables
- Controlled production go-live and live monitoring.
- Preflight checklist completion.
- Incident command workflow active.

### Implementation Tasks
- Promote tested build from staging to production.
- Run production smoke tests before attendee opening.
- Activate monitoring, alert routing, and ops dashboard observers.
- Keep feature flags ready for selective hot-disable of module/QR/reward.

### Test Cases (Completion Criteria)
- Production smoke suite passes (auth, scan, leaderboard, redemption, export access).
- Dashboard metrics match first live traffic window.
- Alerting path verified end-to-end to on-call owner.

### Non-negotiables
- Change freeze during peak event window except incident fixes.
- All critical alerts must page the assigned on-call owner.

---

## Phase 10 (May 27-June 5, 2026) - Archive, Analytics, Handover

### Deliverables
- Post-event archive transition.
- Sponsor and operations reporting exports.
- Final handover package and acceptance checklist.

### Implementation Tasks
- Execute archive transition and verify attendee-only access behavior.
- Generate sponsor lead exports respecting consent and policy boundaries.
- Produce post-event analytics package and operational summary.
- Verify backup/restore procedure and complete handover artifacts.

### Test Cases (Completion Criteria)
- 10-day attendee access expiration triggers correctly on June 5, 2026 (for May 26 event day).
- Sponsor export pack verified for consent correctness.
- Backup/restore drill reproduces data and integrity checks.

### Non-negotiables
- No closure without reproducible backup/restore validation.
- No handover completion without signed acceptance checklist.

---

## Cross-Phase Test Strategy
- Unit tests:
  - Domain determinism (lifecycle transitions, scoring, limits, consent filtering).
- Integration tests:
  - Transaction boundaries, RBAC, idempotency enforcement, queue processing.
- E2E tests:
  - Attendee happy path and failure path.
  - Staff/admin high-risk operational paths.
- Non-functional tests:
  - Load, abuse/rate-limit behavior, observability signal integrity, migration safety.

## Phase Gate Definition
A phase is complete only when:
1. All phase P0 test cases are green in CI.
2. Staging smoke pass is green for that phase scope.
3. Non-negotiables are confirmed with evidence (test output, logs, or runbook checklist).
4. No unresolved Sev-1 or Sev-2 defects remain in that phase boundary.

## Assumptions and Locked Defaults
- Event day baseline is Tuesday, May 26, 2026.
- Platform baseline is Next.js fullstack + Supabase Postgres + Upstash Redis + queue-driven jobs.
- v1 excludes native apps, browser push, live Forumm integration, and sponsor logins.
- Legal policy text and sponsor consent wording are externally provided before Phase 5 lock.
