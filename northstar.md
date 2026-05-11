North Star — SalesGeek Scotland Event Companion App
This document defines the complete end-state of the project. It enumerates every module, every functionality, the final deliverables, and additional features recommended for a high-quality handover to SalesGeek Scotland for Scottish Growth Expo 2026 (Hampden National Stadium, Glasgow) and reuse for future events.

Anything listed here must be implemented, tested, documented, and demonstrably working at the time of handover unless explicitly marked as "Recommended Addition" (a proposed enhancement beyond the original PRD).

1. Vision
A mobile-first, event-based companion web app branded as SalesGeek Scotland's event app for Scottish Growth Expo 2026.
Single shared domain with event-specific slugs, designed as a reusable event platform — not a one-off landing page.
Supports three lifecycle modes on the same URL: pre-event, event-day, and post-event archive.
Forumm remains the public listing/ticketing source — this app is the operational companion product.
The app must feel like a focused event-day operational product, not a marketing microsite.
Real prize competition with full auditability for scoring, redemptions, reversals, disqualifications, and reward completion.
2. Foundational Platform Capabilities
2.1 Multi-Event Platform Architecture
Every domain record is event-scoped (attendees, QRs, rewards, agenda, sponsors, etc.).
One shared domain (e.g. app.salesgeek.scot) with event slugs (e.g. /sge2026).
Per-event branding, content, configuration, and visual identity layer.
Canonical event name configurable per event (default: Scottish Growth Expo 2026).
Host/powered-by brand configurable (default: SalesGeek Scotland).
Event-level lifecycle state machine: pre-event → event-day → post-event archive.
Per-event feature toggles for modules that may not apply in future events.
2.2 Mobile-First Frontend
Mobile web only for v1 — no native, no PWA install prompts, no browser push.
Optimized for poor venue connectivity: lightweight pages, small assets, retry handling, idempotent server actions.
Distinct event visual system managed in admin — Forumm banner explicitly ignored.
Five-tab attendee navigation: Home, Agenda, Geeks, Rewards, Leaderboard.
Secondary items (Sponsors, FAQs/Help, Profile, Terms/Privacy) live outside the five-tab structure.
2.3 Backend Architecture
Deep, isolated domain modules (scoring engine, identity, QR system, reward engine, sponsor engagement) with interface-level tests.
Thin presentation/API layer around domain modules.
Idempotent server actions across all award/redemption flows.
Audit log capability built into all sensitive write paths.
2.4 Data Layer
Relational store with strong constraints for prize-eligibility-critical data.
Two distinct ledgers per attendee: competition score and spendable balance.
Inventory tracking for every redeemable.
Background capture of acquisition source and lightweight session/device metadata (no full fingerprinting).
Retention rules: attendee access expires 10 days post-event; admin/reporting data retained indefinitely.
3. Attendee Modules
3.1 QR-Led Arrival & Pre-Registration
Event-desk QR opens the companion app directly on the entry page.
Entry page shows event name and context above the form.
Pre-registration available before event using same URL; recognized on event-day return.
Form captures: real name, email, phone, business.
Email OTP triggered post-submission.
Attendee can continue into the app while OTP is pending (registration desk does not stall).
OTP verification required for prize eligibility.
Pre-signup QR scan must be preserved through registration and awarded post-signup.
Acquisition source captured at signup.
3.2 Identity & Session Management
Email is canonical, immutable identity key (admin correction only).
Phone is informational and self-service editable.
Business name locked after signup (admin override only).
Real name editable by attendee.
Public alias auto-generated; one self-service edit allowed.
Duplicate prevention by email (basic, v1).
Browser session persistence across the event day across repeated QR scans.
Passwordless: email OTP only (no SMS, no passwords in v1).
3.3 Check-In
Automatic check-in on first event-day app entry.
Staff/admin override for manual check-in.
Only checked-in attendees can meaningfully participate in leaderboard and point mechanics.
3.4 Onboarding & In-App Education
Short onboarding screen on first entry.
Onboarding content always retrievable from Help.
"How points work" explainer.
Profile QR shown in app for staff identification.
3.5 Home Tab
Live event context prioritized over game mechanics.
Now / up-next sessions surface.
Live announcements feed.
Personal points, rank, spendable balance, and category progress blocks (from a small fixed set).
Progress blocks must not reveal hidden QR locations.
Subtle indicator for next hidden-bonus hint unlock time.
3.6 Agenda Tab
Chronological default.
Filters: stage, category, type.
Session detail pages with speaker, sponsor, location, status context.
Session points require scanning the physical venue QR (active in configured window only).
Live status reflected in real time (current / upcoming / past / cancelled).
3.7 Geeks Tab
Four host SalesGeeks: photo, bio, contact/calendar links.
Regular Geek booking/contact links freely accessible (not gated).
William appears both as a host and as a speaker.
William's premium reward (post-event strategy session, priority access, limited slots) is distinct from his ordinary public booking link.
3.8 QR Scanning Engine (Attendee-Facing)
Unified scan flow — every QR opens the same companion app.
Auto-award on page load (no extra tap).
Confirmation message with QR name and awarded points.
Repeat-scan messaging ("already collected").
Inactive / time-locked QR messaging explains why unavailable.
Sponsor, session, and hidden bonus QRs feel different in purpose.
Sponsor QR points and session QR points visible by default; hidden bonus point values hidden.
Hidden bonus hints reveal broad zones only and unlock gradually on schedule.
Hidden bonus QRs inactive until reveal time.
Each scan ends with a contextual next-action CTA (no dead-end screens).
Idempotent server award — no double-credit on retry.
3.9 Sponsor Pages
One personalized sponsor page per sponsor, per attendee.
Sponsor website button.
Scan-collected status visible.
One-tap "I'm interested" with undo.
Interest does NOT affect points.
Sponsor sharing consent collected separately from general event terms consent.
Lead sharing only for opted-in attendees.
3.10 Rewards Tab
All active rewards visible (locked rewards subtly indicated, not hidden).
Self-service rewards separated from staff-only rewards.
Reward cards show collection instructions, state (available / locked / sold out / redeemed / expired).
Expired rewards remain visible in history.
Per-reward redemption limits enforced (default: 1 per attendee).
William reward: points deducted only after Calendly booking confirmation; inventory is a fixed app-managed quantity; no hold state in v1; reconcilable retry behavior on failure.
3.11 Leaderboard Tab
Top 10 + own rank.
Public presence uses alias only — no real-name exposure.
Unverified attendees can appear; only verified attendees are prize-eligible.
Ranking by competition score only — spending does not affect rank.
Tie-break: earliest time reaching the score (not emphasized on the public screen).
Visible prize deadline.
Scoring stops at deadline unless a QR is explicitly configured otherwise.
3.12 Notifications (Attendee)
In-app notification feed for upcoming sessions and event updates.
No browser push in v1.
Immediate and scheduled notifications.
3.13 Help / FAQs
Structured, searchable FAQ system (no chatbot).
Editable on event day from admin panel.
Includes onboarding rerun and "how points work" content.
3.14 Profile
Profile QR for staff identification.
Editable fields: phone, real name, alias (one edit).
Locked fields: email, business.
Scan history view.
Lightweight "need help with points?" path (no full dispute system).
3.15 Venue Guidance
Simple venue map/floorplan if available.
Text-based directions as fallback when no floorplan exists.
Locations grouped by broad zones.
3.16 Post-Event / Archive Mode (Attendee Side)
Clear archive state after event end.
10 days of continued attendee access to own profile, history, and final leaderboard.
Final anonymous leaderboard visible only to logged-in attendees (no public unauthenticated results page).
Reward expiry independent of attendee archive timing.
Access expires after 10 days unless admin reopens.
4. Admin Modules
4.1 Event Setup & Configuration
Create, configure, and clone events.
Manage canonical event name and host/powered-by branding per event.
Event slug management.
Lifecycle state control: pre-event / event-day / post-event archive.
Event-level branding (colors, logos, imagery).
Per-event feature toggles.
4.2 Public Content Management
Nearly all attendee-visible content editable per event.
Agenda CRUD with live status control (allows in-day timing changes).
Speakers CRUD with bio, photo, sessions linked.
Geeks CRUD (host SalesGeeks): photo, bio, contact/calendar links.
Sponsors CRUD: pages, website, location/zone, points config.
FAQ CRUD (editable on event day).
Venue map/floorplan upload and text directions.
Onboarding and "how points work" content.
4.3 Attendee Management
CSV attendee import (no live Forumm integration in v1).
Email-based matching on arrival to continue existing records.
Search by name, email, phone, alias, profile QR.
View attendee profile, ledger history, scan history, redemption history.
Edit attendee fields (including identity-locked fields with audit).
Flag, freeze, disqualify suspicious accounts.
Manual duplicate merge.
No admin impersonation in v1 — preview-as-attendee content view only.
4.4 QR Management
Create, configure, test, preview, and export QR codes.
Per-QR attributes: name, type, points, active state, reveal/timing settings, repeat rules, sponsor or session association, point visibility, venue zone, staff-validation flag.
Session QRs: configurable active windows tied to session time.
Hidden bonus QRs: reveal-time scheduling and zone hints.
Print-ready exports as branded images, cards, and posters.
Test/preview mode for every QR before printing.
Staff-validation required type for high-value actions.
4.5 Rewards Management
Create rewards by type, cost, inventory, per-attendee limit, expiry.
Self-service vs staff-only classification.
Inventory tracking for both physical merch and the William strategy session.
Reward-specific expiry independent of attendee archive timing.
William reward: fixed app-managed inventory, Calendly confirmation as source-of-truth for completion, retry/reconcile logic for failed bookings.
Reward reversal flow (admin-only, requires reason, fully audited).
4.6 Sponsor Engagement Admin
Sponsor scan vs sponsor interest captured as separate lead strengths.
Sponsor lead export gated by attendee consent.
Sponsor reporting available during and after the event without sponsor logins.
No sponsor dashboard in v1 — admin controls all sponsor exports and communications.
4.7 Notifications Admin
Compose, send immediate, and schedule in-app notifications.
Targeting capability in data model; broadcast-first as operational default.
Notification logs.
4.8 Live Event-Day Operations Dashboard
Auto-refreshing ops view with manual refresh fallback.
Key metrics at a glance: check-ins, OTP verifications, top-of-leaderboard movement, scan volume, sponsor interest counts, reward redemptions, inventory low alerts.
Built into the same admin system — not a separate operations app.
4.9 Roles, Auth & Permissions
Two roles: Admin and Staff.
Individual (non-shared) staff accounts for attributable action history.
Passwordless admin/staff login via magic link or email OTP.
Role enforcement throughout the backend (not just UI gating).
All sensitive actions logged (score adjustments, reversals, disqualifications, merges, reward overrides).
4.10 Reporting & Exports
CSV/JSON exports for: attendees, sponsor leads, leaderboard, scans, rewards/redemptions, notification logs.
Consent-aware sponsor lead exports.
Post-event analytics summaries per event: attendance, scoring, QR activity, sponsor engagement.
Acquisition-source breakdowns.
4.11 Archive & Post-Event Controls
Per-event archive transition controls.
10-day attendee access window enforced server-side.
Admin ability to reopen attendee access or full event access after archive.
Reward expiry independent timeline.
Admin/reporting data retained beyond attendee access window.
4.12 Audit Log Viewer
Searchable audit log surface for all sensitive operations.
Attributable to individual staff/admin account.
Reason text required for high-stakes operations (reward reversal, disqualification, identity-field override).
5. Staff Modules
Attendee profile QR scan flow for fast redemption at the desk.
Attendee search by multiple identifiers.
Staff-only reward redemption with on-card collection instructions.
Predefined point actions (whitelisted, no arbitrary score adjustment).
View attendee check-in and OTP verification status before redemption.
6. Domain Engines (Core Backend Modules)
6.1 Scoring & Redemption Engine
QR award processing.
Repeat-scan idempotency.
Leaderboard score updates.
Spendable balance updates.
Reversals.
Reward inventory changes.
Per-attendee reward limits.
William reward reconciliation against Calendly confirmation.
Two-ledger architecture (competition score vs spendable balance).
6.2 Identity & Access Layer
Canonical email identity logic.
OTP issuance and verification state machine.
Pre-registration continuation flow.
Event-day check-in logic.
Archive access expiry.
Duplicate prevention by email.
6.3 QR & Progress System
Inactive-code handling.
Reveal windows.
Session time windows.
Scan preservation through signup.
Already-collected handling.
Category/zone progress summary generation.
6.4 Sponsor Engagement Layer
Sponsor scan capture.
Interest toggle (with undo).
Consent-aware lead visibility.
Export shaping for different lead strengths.
6.5 Notification Engine
Immediate and scheduled in-app notifications.
Targeting primitives in the data model.
Delivery log.
6.6 Audit Engine
Capture of who/what/when/why for every sensitive write.
Queryable surface for admin viewing and exports.
7. Cross-Cutting Concerns
Security: OWASP top-10 hygiene, OTP brute-force protection, rate limiting on auth and scan endpoints, server-side role enforcement, secure session handling, signed/expiring QR payloads where appropriate.
Privacy/Legal: explicit separation between general event terms acceptance and sponsor lead-sharing consent. Surfaces in UX and data model. Data export endpoints for compliance support.
Auditability: every score change, reversal, disqualification, redemption, booking-triggered completion, and duplicate merge must have defensible operational history.
Performance: small assets, fast first paint on mobile, retry-tolerant client behavior, idempotent server endpoints.
Observability: structured logs, basic error tracking, ops-dashboard signals.
Accessibility: WCAG 2.1 AA on attendee surfaces; legible color contrast on event branding.
Internationalization-readiness: copy in a single source so future localization is not a rewrite (no hard requirement to ship multiple languages).
8. Testing Expectations
Behavioral tests, not implementation-detail tests.
Highest-value test target: scoring and redemption engine (QR awards, idempotency, leaderboard, balance, reversals, inventory, reward limits, William reconciliation).
Identity & access: canonical email, OTP state, pre-reg continuation, check-in, archive expiry, duplicate prevention.
QR & progress: inactive codes, reveal windows, session windows, scan preservation through signup, already-collected handling, category summaries.
Sponsor: scan capture, interest toggle, consent-aware lead visibility, export shaping.
Admin/staff permissions: role-based behavioral tests.
Exports: completeness and permission boundaries for attendees, sponsor leads, leaderboard, scans, rewards, notifications.
Archive: attendee cutoff, final leaderboard visibility, admin reopen.
CI runs the test suite on every push.
9. Out of Scope (Explicit Non-Goals for v1)
Native mobile apps.
Full PWA install prompts or advanced home-screen install work.
Browser push notifications.
Live Forumm integration / ticket validation enforcement.
Sponsor logins or sponsor dashboards.
Public attendee directory or attendee-to-attendee networking.
Social sharing.
Favorites/bookmarks of sessions or speakers.
Full dispute/ticketing system.
Full mission engine (mission builders, overlap rules, mission-specific bonuses).
Public unauthenticated final leaderboard.
Chatbot help.
SMS OTP.
Password-based accounts.
Full offline mode with local scoring reconciliation.
Self-service attendee account deletion.
Outbound marketing/reminder/sponsor-follow-up email from the app (OTP and booking-related system emails only).
Live Calendly-derived dynamic reward inventory.
Admin impersonation flows.
10. Build Order (Required Sequence)
Admin event setup.
Attendee signup and check-in.
Agenda, Geeks, and sponsors.
QR scoring and leaderboard.
Rewards.
Notifications.
Reporting and archive.
Each phase exits only when its module is functional, tested, and demoable end-to-end.

11. Final Deliverables (Client Handover Package)
The project is considered complete only when all of the following are delivered.

11.1 Software Deliverables
Production-deployed companion app on the agreed shared domain with the sge2026 event slug fully configured.
Production-deployed admin panel under the same system with role-based access.
Staging environment mirroring production for client UAT.
All source code in the client-owned repository with clean main branch.
All environment configuration documented, with secrets stored in the agreed secrets manager.
11.2 Event Data Deliverables
Scottish Growth Expo 2026 event fully configured: branding, agenda, speakers, host Geeks, sponsors, FAQs.
All QR codes generated, tested, previewed, and exported as branded print-ready images/cards/posters.
Reward catalog configured with inventory, including the William premium strategy session reward.
Notification templates pre-loaded where applicable.
Initial CSV attendee import (if list provided by client).
11.3 Documentation Deliverables
System architecture document: services, data model overview, domain engine boundaries, deployment topology.
Admin user manual: covering every admin module with screenshots and step-by-step workflows.
Staff playbook: event-day workflows for the registration desk, redemption desk, attendee help, and ops dashboard.
QR operations guide: how to create, configure, test, print, and place each QR type, plus reveal-time mechanics for hidden bonus codes.
Reward operations guide: managing inventory, redemption, reversals, and William reward reconciliation.
Run-of-show guide: pre-event, event-day, and post-event operational checklists.
Incident playbook: common edge cases (OTP failures, duplicate accounts, scoring disputes, reward stockouts, Calendly booking failures, archive reopens) with resolution steps.
API/integration reference: documented endpoints for admin/staff tooling.
Data dictionary: every exportable field across attendees, scans, leads, rewards, notifications.
Privacy & consent documentation: covering general event terms vs sponsor lead-sharing consent flows.
11.4 Training & Enablement
Live admin training session for SalesGeek Scotland operators.
Live staff training session for event-day staff.
Recording of both training sessions delivered to client.
Dry-run/rehearsal event in staging with the client team operating the panel end-to-end.
11.5 Operational Readiness
On-the-day support arrangement defined and agreed.
Monitoring/alerting hooked up for production.
Backup/restore procedure documented and verified.
Post-event archive transition rehearsed in staging.
Reward expiry, archive expiry, and reopen procedures verified.
11.6 Handover Artifacts
Repository access transferred to client ownership.
Domain, DNS, hosting, and third-party service credentials transferred.
Final acceptance checklist signed off against this North Star document.
Post-event analytics report produced after Scottish Growth Expo 2026.
12. Recommended Additions (Beyond the Original PRD)
These are proposed enhancements that strengthen the deliverable. Each is optional and should be confirmed with the client before inclusion.

12.1 Operational Resilience
Server-side idempotency keys on all award/redemption endpoints to guarantee that flaky mobile connectivity never produces double-credit or double-spend. (Strongly recommended — directly supports the auditability requirement.)
Read-replica or cached read path for leaderboard and Home screens to keep reads cheap under event-day load spikes.
Synthetic load test of the scoring engine before event day at 2–3× expected concurrent scan volume.
Feature flag system for hot-disabling specific QRs, rewards, or modules during the event without a redeploy.
12.2 Trust & Safety
Soft rate limit per attendee per minute on QR scan attempts to dampen automated farming attempts.
Anomaly review queue in admin: surfaces accounts with unusual scan velocity, duplicate-device signals, or impossible geographic patterns for admin triage. Read-only signals, not automated action.
Admin "what changed?" diff view on attendee profiles to make audit review faster.
12.3 Attendee Experience
"Save to phone" guidance card explaining how to bookmark/add-to-home-screen without requiring a real PWA install. Lowers re-entry friction without expanding scope.
Connectivity indicator so the attendee sees when an action is queued vs confirmed.
Optimistic UI on scan confirmation with server reconciliation — the confirmation screen renders instantly while the award call completes in the background.
Empty-state polish across every tab so pre-event mode looks intentional rather than half-built.
12.4 Admin / Operator Experience
Bulk QR generation wizard for venue-wide QR sets (e.g. "generate 30 hidden bonus QRs across these zones with this schedule").
Pre-flight checklist screen for the event-day transition, blocking the mode switch until critical config is verified (rewards have inventory, agenda has live times, QRs are active, branding is set).
Real-time activity feed on the ops dashboard (last N scans, last N redemptions) to give operators a tangible sense of event flow.
"Preview as attendee" deep link — read-only view of any attendee's app state for support without enabling impersonation.
12.5 Reward & Sponsor Mechanics
Stock-low admin alerts at configurable thresholds per reward.
Sponsor engagement summary card in admin showing scans / interests / conversion per sponsor in near real time.
Reward redemption receipt in attendee history for every redemption with timestamp and staff attribution where applicable.
12.6 Post-Event Value
Attendee summary screen at archive: their final rank, total scans, rewards redeemed, sessions attended. Useful for the client to share with attendees and reinforces brand affinity.
Sponsor packet generator: one-click export of a sponsor's per-event report as a branded PDF/CSV bundle, gated by consent rules.
Lessons-learned template populated with event analytics for SalesGeek's own internal retro.
12.7 Platform Reusability
Event clone action in admin: spin up a new event from a previous one's structure (agenda categories, FAQ baselines, reward types, sponsor templates) without code changes.
Brand kit slot per event so reusing the platform for a non-SalesGeek-branded event in future is purely configuration.
Content versioning on attendee-visible content (agenda, FAQs) so accidental overwrites during event day are reversible.
12.8 Compliance Posture
Per-attendee data export endpoint (downloadable JSON) to support any future subject-access request without engineering involvement.
Per-attendee data deletion job (admin-triggered only in v1, per scope) for post-event GDPR support, even though self-service deletion is out of scope.
Consent change log so the history of a given attendee's consent toggles is preserved.
13. Definition of Done (Project-Level)
The project is done when:

Every module in sections 3, 4, 5, and 6 is implemented and behaves as specified.
The testing expectations in section 8 are met and the test suite is green in CI.
Every item in section 11 (Final Deliverables) is delivered.
The client has run an end-to-end rehearsal on staging and signed off.
Scottish Growth Expo 2026 has been operated on production using the system, and the post-event archive transition has been executed cleanly.
The post-event analytics report has been delivered to SalesGeek Scotland.
Anything outside this list is either explicitly out of scope (section 9) or a Recommended Addition (section 12) requiring client agreement before being treated as in-scope.
