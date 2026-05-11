# SalesGeek Expo Companion Platform - Phase-wise Implementation Plan

## Delivery Objective
Ship a production-ready, multi-event companion platform for Scottish Growth Expo 2026 with deterministic scoring/reward behavior, auditability, and operational resilience for 5,000+ attendees and 500+ peak concurrent users.

## Global Rules (apply to every phase)
- No phase closes without all P0 tests passing in CI and staging smoke checks passing.
- No privileged write path is acceptable without RBAC and audit logging.
- No event-scoped table/query may operate without explicit `event_id` filters.
- No scoring or redemption write path may be non-idempotent.
- Canonical entity model is fixed: `admin`, `staff`, `business`, `attendee`.

## Deliverable Traceability Lock (20/20)
- The implementation must explicitly deliver all 20 capabilities from `deliverables.md` and preserve one-to-one traceability in phase acceptance.
- Mandatory capability checklist:
  1. One event URL with lifecycle modes: pre-event, event-day, post-event archive.
  2. QR-led desk entry to the app.
  3. Pre-registration continuity into event-day experience.
  4. Email OTP passwordless identity with prize-eligibility gating.
  5. Auto check-in on first event-day entry with staff override.
  6. Attendee Profile QR for staff identification and desk workflows.
  7. Home screen with live now, up-next, announcements, points, rank, and progress.
  8. Agenda with stage/category/type filters and live status.
  9. Geeks tab with four host SalesGeeks, photo, bio, and contact/calendar links.
  10. QR game with sponsor/session/hidden-bonus types, auto-award, one-scan-per-attendee.
  11. Time-released hidden bonus QRs with zone-based hints.
  12. Personalized sponsor pages with scan state, interest toggle/undo, consent-gated sharing.
  13. Rewards catalog with self-service/staff-only sections, inventory, limits, and state labels.
  14. William premium reward completed only via confirmed Calendly booking.
  15. Anonymous leaderboard: top 10 + own rank, alias-only, visible prize deadline.
  16. In-app notifications (immediate + scheduled), no browser push in v1.
  17. Searchable structured FAQs/help editable on event day.
  18. Admin panel coverage across events, content, QRs, rewards, notifications, branding.
  19. Live ops dashboard + staff tools (redemption/search/predefined actions) with audit logs.
  20. Reporting/exports + archive transition with 10-day attendee access.
  21. Admin CSV exports must always reflect latest available real-time data at export execution time.

---

## Phase 0 (May 12-13, 2026) - Foundation and Architecture Skeleton

### Deliverables
- Monorepo scaffold (`apps/web`, `packages/domain`, `packages/db`, `packages/contracts`, `packages/config`).
- Base Postgres schema and migration pipeline.
- RBAC primitives (`attendee`, `staff`, `admin`).
- Shared validation contracts and error model.
- Audit logger abstraction integrated into mutation service layer.
- Base business model and export-grade attendee/business detail schema.

### Implementation Tasks
- Initialize pnpm + Turborepo workspace and CI workflows.
- Configure Supabase project bindings and env matrix (`local`, `staging`, `prod`).
- Create base entities: `events`, `users`, `attendees`, `staff_accounts`, `audit_logs`.
- Create entity tables for `admins`, `staff`, `businesses`, `attendees`, with event scope and strict foreign keys.
- Add detailed capture tables for `qr_codes`, `scan_events`, `point_awards`, and audit-linked export metadata fields.
- Implement migration scripts and rollback verification commands.
- Introduce service-layer pattern for domain modules and a common transaction wrapper.

### Test Cases (Completion Criteria)
- CI runs `typecheck`, `lint`, `unit` on a minimal vertical slice.
- Migration up/down cycle passes on clean database.
- RBAC test verifies `staff` cannot execute admin-only mutation.
- Audit test verifies audit row is generated on a protected write.
- Schema contract test verifies four-entity model and referential integrity constraints.

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
- Attendee Profile QR generation and retrieval for staff-facing identification.
- Seamless attendee login flow with silent session continuity across repeated event-day entries.

### Implementation Tasks
- Build prereg/event-day unified registration flow.
- Define immutable identity rules (email immutable except admin override).
- Implement pending-OTP app access with prize eligibility gating.
- Persist pre-signup scan context and replay post-registration.
- Add rate limits for OTP issue/verify endpoints.
- Implement seamless login pattern:
  - Event desk QR deep-link includes event slug context.
  - OTP pending users can continue to non-restricted app areas.
  - Long-lived event-day session cookie + silent refresh avoids repeat login friction.

### Test Cases (Completion Criteria)
- Pre-signup QR scan is preserved and awarded after signup.
- Duplicate registration by same canonical email maps to existing attendee.
- OTP brute-force protection test blocks repeated invalid attempts.
- Session continuity test validates repeated QR scans keep same attendee session.
- Profile QR test validates attendee QR resolves to the correct attendee profile in staff flow.
- Re-entry test validates attendee is not forced to re-authenticate during active event-day session.

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
- Home tab includes live now/up-next, announcements, and attendee points/rank/progress blocks.
- Agenda supports filters by stage, category, and type, with live session status.
- Geeks tab includes four host SalesGeeks with photo, bio, and contact/calendar links.
- FAQ/help module is structured, searchable, and editable on event day.

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
- Agenda filter tests validate stage/category/type filtering behavior.
- Home tab content test verifies live-now/up-next/announcements and points/rank/progress visibility.
- Geeks tab test verifies all four host profiles render with required content fields.
- FAQ/help test verifies search behavior and event-day admin edit propagation.

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
- Anonymous leaderboard presentation with top 10 + attendee own rank, alias-only display, and visible prize deadline.
- QR generation engine with idempotent create semantics for both business-owned and staff-misc QRs.
- Staff-managed miscellaneous QR creation flow (for example guest speakers) with policy-based guardrails.

### Implementation Tasks
- Implement QR payload signing + verification.
- Implement scan processor with idempotency key enforcement.
- Add QR type rules (`sponsor`, `session`, `hidden_bonus`, `staff_validated`).
- Create leaderboard read model sorted by score desc + reached_at asc.
- Add explicit user messaging states for already-collected/inactive/pre-reveal.
- Implement QR ownership model:
  - `owner_type = business | staff_misc`
  - `owner_id` required for ownership traceability.
- Implement idempotent QR create endpoint keyed by event + owner + purpose fingerprint.

### Test Cases (Completion Criteria)
- Retry-storm test proves no double-credit under repeated identical scan submissions.
- Hidden bonus scan before reveal returns correct denial reason.
- Session QR outside active window is rejected.
- Tie-break test verifies earliest timestamp at same score ranks higher.
- Leaderboard contract test verifies alias-only public rows, top-10 slice, own-rank inclusion, and deadline visibility.
- QR generation idempotency test verifies duplicate create requests return the same QR record.
- Staff QR permission test verifies staff can create only allowed miscellaneous QR categories, not unrestricted admin QR types.

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
- Detailed admin export views for attendee and business datasets with scan, award, and consent lineage.
- Admin-triggered CSV export jobs that read from current source-of-truth tables/read-models and output latest real-time data snapshot.

### Implementation Tasks
- Define export schemas and field dictionary.
- Implement consent and role-based export filtering.
- Implement archive window policy based on event end timestamp.
- Build reopen operations for attendee/event-level access exceptions.
- Include detailed fields in export contracts for businesses and attendees:
  - identity/profile state
  - consent state/history
  - QR ownership and scan-level outcomes
  - award/reversal lineage and actor attribution
- Implement real-time export semantics:
  - Export endpoint reads latest committed data at request time (no stale cached file reuse).
  - For heavy exports, run job-based CSV generation with `as_of_timestamp` embedded in file metadata and audit record.
  - Ensure leaderboard/export read models are refreshed before export finalization if lag threshold is exceeded.

### Test Cases (Completion Criteria)
- Archive cutoff test passes at exact boundary timestamp.
- Reopen action restores access as expected and creates audit entry.
- Final leaderboard remains attendee-authenticated only in archive mode.
- Export schema contract tests validate exact field set and ordering.
- Export completeness tests validate business and attendee detailed fields are populated and queryable by admin.
- Real-time export test validates a newly committed scan/reward/action is present in CSV generated immediately after the write.
- Export freshness test validates the `as_of_timestamp` is within acceptable freshness SLA from export trigger time.

### Non-negotiables
- Export fields must match published data dictionary exactly.
- Archive policies must be enforced server-side, never UI-only.
- Admin CSV export must represent latest real-time data snapshot at execution time.

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
