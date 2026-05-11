# Final Implementation Plan – SalesGeek Scotland Event Companion App

## Overview
This document provides a **clear, detailed yet straightforward** roadmap for building the SalesGeek Scotland companion web app for the Scottish Growth Expo 2026. It aligns with the 20 core deliverables, the role model (Admin, Staff, Business, Attendee), and the updated QR handling rules.

---

## Roles & Permissions
| Role | Primary Capabilities |
|------|----------------------|
| **Admin** | - Magic‑link login<br>- Full CRUD for events, agenda, geeks, sponsors, QR generator, rewards, notifications, reporting<br>- Manage Staff accounts |
| **Staff** | - Magic‑link login (same flow as Admin)<br>- Generate QR codes for **Attendees** and **Businesses** only (cannot edit business QR once created)
| **Business** | - Auto‑assigned a **single permanent QR** on onboarding<br>- Can view its own profile page and networking endpoint
| **Attendee** | - Self‑service signup (email OTP)<br>- Auto‑check‑in on first app entry (event‑day)<br>- Scan any QR (award points, redeem rewards)

> **Key rule**: *Only Admin and Staff can generate QR codes. Each Business receives exactly one immutable QR; no regeneration or multiple QR creation is allowed.*

---

## Phase‑wise Detailed Implementation

### Phase 1 – Core Platform & Multi‑role Foundation
- **Scaffold**: Next.js 14 (App Router) + Tailwind v3 + Prisma v5 + tRPC v11.
- **Database**: Add `User` table with enum `role` (`ADMIN`, `STAFF`, `BUSINESS`, `ATTENDEE`). Add `eventId` foreign key on all domain tables for multi‑event isolation.
- **Auth**: Implement password‑less magic‑link flow for Admin/Staff using `jose` JWT and Redis single‑use keys. Store role in `iron‑session` cookie.
- **Admin UI**: `(admin)` route group with pages to create an `Event` (name, slug, branding, lifecycle state).
- **Branding**: Persist event‑level colors in DB; inject as CSS custom properties at layout level.

**Test Cases**
1. Admin can log in via magic link, cannot reuse the link.
2. Event creation stores `eventId` and branding; subsequent requests are scoped to that `eventId`.
3. Role‑based middleware correctly rejects a Staff endpoint when accessed by an Attendee.

**Non‑Negotiables**
- Prisma schema must enforce `eventId` on every table.
- Magic‑link must be single‑use and expire after 15 min.
- UI shell must reflect dynamic branding immediately.

---

### Phase 2 – Attendee Identity, OTP & Auto‑Check‑in
- **Signup form**: Email, real name, optional business name, phone.
- **OTP flow**: Generate 6‑digit code, hash, store in Redis (10 min TTL), send via Resend.
- **Session**: Create `iron‑session` on form submit (`isVerified:false`). After OTP success, set `isVerified:true`.
- **Auto‑Check‑in**: Middleware detects first protected route request on **event‑day** mode; sets `checkIn:true`.
- **Profile QR**: Generate QR for each Attendee on successful verification (stored in `QRCode` table, immutable).

**Test Cases**
1. Attendee registers, receives OTP, verifies, session updates.
2. Invalid OTP 5 times locks verification for 15 min.
3. Auto‑check‑in toggles on first app load after event‑day switch.
4. Attendee QR is generated once and cannot be regenerated.

**Non‑Negotiables**
- Attendee must access the app before OTP verification (to support desk flow).
- Email is immutable; subsequent changes require Admin correction only.

---

### Phase 3 – Business Onboarding & Permanent QR Assignment
- **Admin UI**: Form to create a Business record (name, contact email, optional logo).
- **QR Generation**: On Business creation, automatically generate a **single permanent QR** linked to the Business `id`. Store in `QRCode` with `type: BUSINESS`.
- **Restrictions**:
  - No UI for Business to generate additional QR codes.
  - Staff can view but **cannot regenerate** the QR.
- **Endpoints**: `GET /api/business/:id/qr` returns QR URL; `GET /business/:slug` renders its profile page.

**Test Cases**
1. Admin creates Business; exactly one QR appears in DB.
2. Attempting to call QR‑generation endpoint as Business returns 403.
3. Staff can fetch the existing QR but cannot create a new one.
4. QR URL correctly routes to a static landing page that logs the scan.

**Non‑Negotiables**
- Business QR must be immutable; any regeneration attempt must fail with a clear error.
- Each Business may have only **one** QR record (unique constraint on `businessId`).

---

### Phase 4 – Public Content (Agenda, Geeks, Sponsors, FAQs)
- **Agenda**: CRUD for `AgendaSession` (time, stage, type). Server‑components render with live status (past / now / upcoming).
- **Geeks**: CRUD for `HostGeek` (photo, bio, Calendly link). Display in dedicated tab.
- **Sponsors**: CRUD for `Sponsor` (logo, page content, lead‑interest toggle). Implement consent‑gated “I’m interested” button.
- **FAQs**: New `FAQ` entity, admin CRUD, searchable UI for Attendees.
- **Routing**: `/[eventSlug]/agenda`, `/[eventSlug]/geeks`, `/[eventSlug]/sponsor/:id`, `/[eventSlug]/faqs`.

**Test Cases**
1. Agenda items show correct live status based on server time.
2. Sponsor “I’m interested” records require explicit consent flag.
3. FAQ search returns results matching query text.
4. All public pages respect event slug for multi‑event isolation.

**Non‑Negotiables**
- Sponsor lead capture must **never** award competition points.
- All public content must be read‑only for Attendees (no edit capability).

---

### Phase 5 – QR Scoring Engine & Leaderboard
- **QR Generator** (Admin/Staff): Use `qrcode` library; signed URLs (`/scan/[code]?sig=[hmac]`). Include QR type (sponsor, session, hidden bonus).
- **Scanning Flow**:
  1. Attendee visits `/scan/:code`.
  2. Server validates HMAC, checks expiry/activation window.
  3. Idempotency key stored in Redis (`scan:{attendeeId}:{code}`).
  4. On first valid scan, execute Prisma `$transaction`:
     - Insert `ScanRecord`
     - Increment `competition_score` and `spendable_balance`
     - Create `AuditEntry`
  5. Return JSON with points awarded or “already collected”.
- **Leaderboard**: Top‑10 query cached in Redis (30 s TTL). Return alias only; tie‑breaker = earliest timestamp.

**Test Cases**
1. Valid QR awards points and updates both ledgers.
2. Refreshing the same QR shows “already collected”.
3. Unauthenticated scan redirects to signup flow; points awarded after registration.
4. Hidden bonus QR before activation returns “not active yet”.
5. Concurrent 100 scans for same QR result in a single award.

**Non‑Negotiables**
- Two ledgers must stay independent; no operation may modify the other.
- Idempotency must guarantee exactly‑once point awarding.
- Leaderboard must never expose real names.

---

### Phase 6 – Rewards Engine (including William Premium Reward)
- **Reward Catalog**: `Reward` entity (cost, inventory, per‑attendee limit, type). Admin CRUD.
- **Redemption Flow**:
  - **Self‑service**: Attendee clicks “Redeem”, client performs optimistic mutation; server checks balance & inventory, locks row (`SELECT FOR UPDATE`).
  - **Staff‑assisted**: Staff scans Attendee QR, selects reward, confirms redemption.
- **William Reward**:
  - Create special `Reward` with `externalId = 'william-premium'`.
  - Webhook `/api/webhooks/calendly/:eventSlug` validates Calendly signature, matches attendee email, deducts required points, marks reward as completed.
- **Inventory & Limits**: Enforced in DB transaction; reject if `inventory <= 0` or attendee exceeds limit.

**Test Cases**
1. Successful self‑service redemption reduces spendable balance and inventory.
2. Insufficient balance disables the redeem button and returns 400.
3. Concurrent redemption of last inventory item grants it to one user only.
4. William webhook completes reward only after successful Calendly confirmation.
5. Staff redemption logs staff ID in `AuditEntry`.

**Non‑Negotiables**
- Spendable balance never drops below zero.
- Inventory never negative.
- William points are deducted **only** after Calendly webhook success.

---

### Phase 7 – Notifications & Operations Dashboard
- **In‑app Notifications**:
  - `Notification` table (title, body, scheduleTime, targetAudience).
  - Admin can broadcast instantly or schedule.
  - Attendee UI polls via TanStack Query (5 s back‑off) and shows badge count.
- **Ops Dashboard (Admin)**:
  - Real‑time metrics: total check‑ins, scans/minute, low‑stock alerts, recent audit entries.
  - Polling (`stale‑while‑revalidate`) every 15 s.
- **Audit Log Viewer**: Table with filters (actor, action, date).

**Test Cases**
1. Admin broadcast appears within 30 s on Attendee UI.
2. Dashboard numbers update correctly after each scan/redemption.
3. Low‑stock alert triggers when inventory ≤ 5.
4. Audit viewer displays staff‑initiated redemption with correct actor ID.

**Non‑Negotiables**
- All manual adjustments must include a mandatory “reason” string stored in `AuditEntry`.
- Notification failures must not crash the UI; fallback to last known state.

---

### Phase 8 – Reporting, Exports & Post‑Event Archive
- **Exports**: CSV/JSON streams for Attendees, ScanRecords, Sponsor Leads (respecting consent flag). Use `json2csv` streaming.
- **Sponsor Lead Export**: Query includes `WHERE consent = true` only.
- **Archive Transition**:
  - Middleware checks `event.state === 'archive'` and blocks all mutating routes.
  - After **10 days** post‑event, attendees are redirected to a static “Event Closed” page; Admin retains full access.
  - Admin can manually override lock for specific attendee.
- **Final Leaderboard**: Visible to logged‑in Attendees during the 10‑day window (still anonymous).

**Test Cases**
1. Export for Sponsor A contains only consenting attendees.
2. Switching event to `archive` blocks QR scans but allows profile view.
3. Simulated 11‑day post‑event access returns “Event Closed”.
4. Admin override restores access for a selected attendee.

**Non‑Negotiables**
- No non‑consenting data must ever be exported.
- Admin must retain indefinite data access after archive.
- Anonymous leaderboard must remain hidden from unauthenticated users.

---

## Acceptance & Review
- Each phase must pass **all listed test cases** before moving to the next.
- Non‑negotiables are **gate criteria**; any violation blocks progression.
- Upon completion of Phase 8, a **handover checklist** (code audit, security review, performance benchmark) must be signed off by the Project Lead.

---

*Prepared by the AI coding assistant. Please review and approve the implementation plan.*
