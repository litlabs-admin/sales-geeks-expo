    # Phase-Wise Implementation Plan
    ## SalesGeek Scotland Event Companion App

    This document outlines the strict, step-by-step implementation plan for the Scottish Growth Expo 2026 companion app. It is broken down into the 7 required phases defined in the PRD. 

    A phase **cannot be exited** until all Test Cases pass and all Non-Negotiables are met.

    ---

    ## Phase 1: Admin Event Setup & Platform Foundation

    ### What to do
    Establish the core repository, the database schema, and the multi-event architecture. Build the admin authentication flow and the admin panel screens to create and configure an event (branding, basic details, lifecycle state). 

    ### How to do it
    - Scaffold Next.js 14 App Router with Tailwind CSS, Prisma, and tRPC.
    - Define the Prisma schema including all core entities (`Event`, `AttendeeEventRecord`, `QRCode`, `Reward`, etc.) ensuring every domain table has an `eventId` foreign key.
    - Implement the `tRPC` admin router and `iron-session` logic.
    - Build the Magic Link authentication flow for Admins using `jose` JWTs and Resend for emails.
    - Build the `(admin)` route group with forms to edit Event Name, Slug (`/sge2026`), Branding (hex colors), and Lifecycle State (`pre-event`, `event-day`, `archive`).
    - Inject DB-stored branding colors into CSS custom properties at the layout level.

    ### When to do it
    **Week 1.** This must be the absolute first piece of code written, as all other domains (attendees, QRs, rewards) depend on the existence of an `Event` record and an Admin to configure them.

    ### Test Cases / Completion Criteria
    1. **Admin Login**: Admin enters email -> receives magic link -> clicks link -> is authenticated and redirected to admin dashboard. Link cannot be reused.
    2. **Event Creation**: Admin creates "Scottish Growth Expo 2026" with slug `sge2026`.
    3. **Multi-Tenant Isolation**: Middleware successfully intercepts `/sge2026/admin` and binds all subsequent tRPC queries to that event ID.
    4. **Dynamic Branding**: Admin changes the primary hex color to `#FF0000`; the frontend base layout instantly reflects the red branding.

    ### 🚨 Non-Negotiables (Gate to Next Phase)
    - Prisma schema MUST have `eventId` relations locked down.
    - Admin magic link auth MUST work securely with single-use invalidation.
    - The base UI shell MUST render dynamically based on DB branding.

    ---

    ## Phase 2: Attendee Identity & Check-in

    ### What to do
    Build the attendee signup, email OTP validation, session persistence, and automatic event-day check-in. Implement the profile screen where attendees can view their auto-generated alias and edit their phone number/name.

    ### How to do it
    - Build the `IdentityService` pure TypeScript module.
    - Create the attendee registration form capturing: Email, Real Name, Business, Phone.
    - Implement the OTP flow: Generate 6-digit code -> Hash and store in DB/Redis with 10-min TTL -> Send via Resend -> Verify via input.
    - Create the `iron-session` logic for attendees. Note: Attendees get a session *immediately* upon form submit, but `isVerified: false`. OTP success updates session to `isVerified: true`.
    - Implement Auto Check-in: Middleware detects first hit to a protected route while Event is in `event-day` mode -> updates `checkIn = true`.

    ### When to do it
    **Week 2.** Following the admin setup, we need users in the system before we can build features for them to interact with.

    ### Test Cases / Completion Criteria
    1. **Signup & Deferred Verification**: Attendee submits registration form. They are dropped onto the Home screen (session created). A banner prompts for OTP.
    2. **OTP Verification**: Attendee enters correct OTP from email. Banner disappears; DB `isVerified` flag becomes `true`.
    3. **Invalid OTP Lockout**: Attendee enters wrong OTP 5 times. System locks OTP verification for that email for 15 minutes.
    4. **Check-in Trigger**: Attendee logs in while event is in `pre-event` mode -> `checkIn = false`. Admin switches to `event-day` mode. Attendee refreshes page -> `checkIn = true`.
    5. **Duplicate Prevention**: Attempting to register with an existing email redirects to OTP flow for the existing account rather than creating a duplicate.

    ### 🚨 Non-Negotiables (Gate to Next Phase)
    - Attendee MUST be able to enter the app without waiting for the OTP email (critical for desk flow).
    - OTP verification MUST accurately toggle the `isVerified` status required for prize eligibility later.
    - Email MUST be treated as immutable after signup.

    ---

    ## Phase 3: Public Content (Agenda, Geeks, Sponsors)

    ### What to do
    Build the read-only and interaction-light modules: the chronological agenda, the host Geeks profiles, and the Sponsor pages including the consent-gated "I'm interested" lead capture. Admin CRUD for all of these.

    ### How to do it
    - Admin Panel: Build standard CRUD tRPC endpoints and forms for `AgendaSession`, `Speaker`, `HostGeek`, and `Sponsor`.
    - Attendee App: Build Server Components to render the Agenda (with filtering by stage/type), Geeks tab, and individual Sponsor pages.
    - `SponsorLayer`: Implement the "I'm interested" toggle using a React Query optimistic mutation. Build the explicit consent capture UI distinct from general event terms.

    ### When to do it
    **Week 3.** This phase establishes the "utility" side of the companion app before introducing the complex game mechanics.

    ### Test Cases / Completion Criteria
    1. **Agenda Display**: Agenda renders chronologically. Live status ("Happening Now") calculates correctly based on current server time.
    2. **William's Profile**: William is visible on both the Geeks tab and as a Speaker on the Agenda. His standard booking link is accessible.
    3. **Sponsor Lead Generation**: Attendee visits sponsor page. Clicks "I'm interested". Checks the separate "I consent to share my details" box. Toggle turns active.
    4. **Sponsor Lead Undo**: Attendee clicks "I'm interested" again. Toggle reverts. Admin DB shows the lead is removed/inactive.

    ### 🚨 Non-Negotiables (Gate to Next Phase)
    - Sponsor lead capture MUST NOT award competition points.
    - Sponsor lead data MUST be gated behind explicit attendee consent.
    - Agenda must support live/upcoming/past status dynamically.

    ---

    ## Phase 4: QR Scoring Engine & Leaderboard

    ### What to do
    The most critical phase: build the QR code generator, the secure scanning pipeline, the two-ledger scoring architecture, and the anonymous public leaderboard.

    ### How to do it
    - Admin: Build QR generator using `qrcode`. Every QR gets a signed URL (`/sge2026/scan/[id]?sig=[hmac]`). Add A4/A5 print exports via `@vercel/og`.
    - `ScoringEngine`: Build the transactional award pipeline. Check Redis idempotency key -> Verify signature -> Verify active/time windows -> Prisma `$transaction` (Insert `ScanRecord`, increment `competition_score`, increment `spendable_balance`, insert `AuditEntry`).
    - Attendee: Build the unified QR scan landing page (`/scan/[id]`) that auto-awards on load.
    - Leaderboard: Build the top 10 query. Cache in Redis for 30s. Display aliases only. Resolve ties by `updatedAt` of the score.

    ### When to do it
    **Weeks 4-5.** The core value proposition of the app. Requires deep focus on database locking and idempotency.

    ### Test Cases / Completion Criteria
    1. **Valid Scan**: Attendee scans valid QR -> UI shows "Awarded 50 points". Both ledgers increase by 50.
    2. **Repeat Scan**: Attendee refreshes the scan page -> UI shows "Already collected". Score does not increase. Redis and DB idempotency hold.
    3. **Pre-Signup Scan**: Unauthenticated user scans QR -> Prompted to register -> Completes registration -> Points from the initial QR are instantly awarded.
    4. **Time-Locked QR**: Attendee scans a hidden bonus QR 2 hours before its reveal time -> UI shows "Code not active yet". No points awarded.
    5. **Leaderboard Tie-break**: User A and User B both have 500 points. User A got 500 points at 10:00. User B got 500 points at 10:05. Leaderboard ranks User A higher.

    ### 🚨 Non-Negotiables (Gate to Next Phase)
    - The two ledgers (`competition_score` and `spendable_balance`) MUST be completely separate in the DB.
    - Scanning the same code 100 times concurrently MUST yield points exactly once (Idempotency).
    - Public leaderboard MUST NEVER leak real names, only aliases.

    ---

    ## Phase 5: Rewards Engine

    ### What to do
    Implement the spendable balance economy. Build the rewards catalog, inventory locking, staff redemptions, and the complex William Calendly reconciliation flow.

    ### How to do it
    - `RewardEngine`: Implement redemption logic. Must check `spendable_balance >= cost`, check inventory `> 0`, and use Postgres `SELECT FOR UPDATE` to prevent race conditions on inventory counts.
    - Build Self-Service (in-app click to claim) vs Staff-Only (requires Staff to scan Attendee's profile QR) flows.
    - William Flow: Build the `/api/webhooks/calendly` handler. It matches email, verifies signature, completes the reward, and deducts the points.

    ### When to do it
    **Week 6.** Follows the scoring engine, as attendees need a spendable balance before they can redeem items.

    ### Test Cases / Completion Criteria
    1. **Self-Service Redemption**: Attendee has 100 balance. Item costs 50. Attendee clicks redeem. Balance drops to 50. Inventory drops by 1. Leaderboard score remains unchanged.
    2. **Insufficient Funds**: Attendee has 10 balance. Item costs 50. Button is disabled. Direct API call returns 400 Bad Request.
    3. **Inventory Race Condition**: Inventory is 1. Two attendees trigger redemption at the exact same millisecond. System awards to one, rejects the other with "Sold out".
    4. **William Webhook Sync**: Attendee holds William reward intent. Calendly webhook fires for that attendee's email. System deducts points and marks reward complete.
    5. **Staff Redemption**: Staff member logs in, searches attendee via Profile QR, clicks "Redeem Coffee" on their behalf. Attendee balance drops. Audit log shows Staff member ID as actor.

    ### 🚨 Non-Negotiables (Gate to Next Phase)
    - Spendable balance MUST NEVER dip below 0.
    - Reward inventory MUST NEVER dip below 0.
    - Point deductions for the William reward MUST NOT happen until the Calendly webhook fires successfully.

    ---

    ## Phase 6: Notifications & Operations Dashboard

    ### What to do
    Build the live event-day operator tools. The live dashboard for the Admin, and the in-app notification feed for attendees.

    ### How to do it
    - Notifications: Add `Notification` table. Create tRPC mutation for Admin to broadcast. Create polling query + Zustand store for Attendee to show red unread badge.
    - Ops Dashboard: Build an Admin page that uses `stale-while-revalidate` polling every 15 seconds to fetch: total check-ins, scans per minute, low-stock warnings.
    - Audit Log Viewer: Build a searchable table in Admin to view the `AuditEntry` records.

    ### When to do it
    **Week 7.** Operational tooling built on top of the completed core domains.

    ### Test Cases / Completion Criteria
    1. **Broadcast Announcement**: Admin sends "Keynote starting in 5 mins". Attendee with app open sees notification badge increment within 30 seconds without hard refreshing.
    2. **Dashboard Accuracy**: Admin dashboard shows 45 redemptions. Attendee redeems an item. Dashboard refreshes to show 46.
    3. **Audit Tracking**: Admin manually adjusts an attendee's score by +100 and enters reason "Missing points at entry". Audit viewer shows Admin Email, Attendee Email, Action, +100, and the string reason.

    ### 🚨 Non-Negotiables (Gate to Next Phase)
    - Manual score adjustments and reward reversals MUST require a text reason and MUST be permanently logged in the audit table.
    - Notification failure must not crash the main UI (graceful degradation).

    ---

    ## Phase 7: Reporting, Exports, & Post-Event Archive

    ### What to do
    Build the data export pipelines and the state machine transition to close the event. Enforce the 10-day post-event attendee access window.

    ### How to do it
    - Exports: Build Node.js route handlers utilizing `json2csv` to stream CSVs of Attendees, Scans, and Sponsor Leads.
    - Sponsor Lead Logic: Query MUST strictly enforce `WHERE consent = true`.
    - Archive Transition: Update Middleware. If Event state is `archive`, restrict all mutation routes. If current date is > 10 days post-event, lock attendees out of the app completely (redirect to "Event Closed" screen).

    ### When to do it
    **Week 8.** Final phase before handover. Prepares the system for the day after the Expo.

    ### Test Cases / Completion Criteria
    1. **Sponsor Lead Export**: Admin clicks export for Sponsor A. The CSV contains only attendees who specifically clicked "I'm interested" AND checked the consent box for Sponsor A.
    2. **Archive Mode Transition**: Admin switches event to `archive`. Attendee attempts to scan a QR code. System rejects the scan. Attendee can still view their profile and the final leaderboard.
    3. **10-Day Expiry**: System clock is simulated to 11 days post-event. Attendee attempts to load the app. They are blocked by the "Event Closed" screen. Admin can still log into the admin panel.
    4. **Admin Reopen**: Admin overrides a specific attendee's archive lockout. Attendee can log in again.

    ### 🚨 Non-Negotiables (Gate to Next Phase / Handover)
    - Sponsor exports MUST NOT include non-consenting attendees under any circumstances.
    - The system MUST allow Admins to access data indefinitely after the event ends.
    - The final anonymous leaderboard MUST be visible to logged-in attendees during the 10-day window, but MUST NOT be a public unauthenticated page.
