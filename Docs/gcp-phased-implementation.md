# SalesGeek Scotland — Phased Implementation Plan
## Scottish Growth Expo 2026 — Event Companion Web App

> **Stack.** Frontend on **Vercel** (Next.js), backend on **GCP** (Cloud Run), data + auth on **Supabase** (Postgres + Supabase Auth + Storage), email on **Resend**, cache/idempotency on **Upstash Redis**. We work against a real Supabase project from day one — no local Supabase CLI, no local Postgres.

> **SQL workflow.** Every phase ships a SQL migration file in `supabase/sql/`. You paste it into the **Supabase Dashboard → SQL Editor** when you start that phase. The folder is built up phase by phase during the build itself — we are not pre-writing all migrations.

> **Sources of truth for scope:** [northstar.md](../northstar.md), [docs/read.md](../read.md), [deliverables.md](../deliverables.md).

---

## How this document is organized

1. **Part 1 — Architecture.** The three-tier split (Vercel + GCP + Supabase) and how the pieces talk.
2. **Part 2 — Accounts & one-time setup.** Supabase, Vercel, GCP, Resend, Upstash, Cloudflare. Walked through in order.
3. **Part 3 — Email (Resend).** Production sending domain, DNS (SPF/DKIM/DMARC), and how Resend powers Supabase Auth emails.
4. **Part 4 — Auth (Supabase Auth).** Email OTP, 24-hour session, anonymous sign-in for the pre-OTP app entry flow.
5. **Part 5 — Notifications.** In-app + Realtime + email — the full three-layer system.
6. **Part 6 — The SQL folder.** Convention for `supabase/sql/` and how phases use it.
7. **Part 7 — The phased build.** Phases 0 through 9. Each phase has:
   - **What we're building** (plain English)
   - **SQL to paste** (file in `supabase/sql/`)
   - **Frontend (Vercel) changes**
   - **Backend (GCP) changes**
   - **Scripts to create**
   - **How to test it**
   - **Test gate**
   - **Non-negotiables**
8. **Part 8 — Production cutover.** Promoting dev → prod Supabase, prod GCP, prod Vercel.

---

# Part 1 — Architecture

## 1.1 The three-tier split

```
                                ┌──────────────────────────────┐
                                │      User (mobile browser)   │
                                └──────────────┬───────────────┘
                                               │ HTTPS
                                               ▼
                              ┌────────────────────────────────┐
                              │           VERCEL               │
                              │   Next.js 14 (App Router)      │
                              │   - UI / pages                 │
                              │   - Public Server Components   │
                              │   - Middleware (slug guard)    │
                              │   - Light edge handlers        │
                              │   - supabase-js (browser)      │
                              └────────┬───────────────┬───────┘
                                       │               │
                       JWT-authed REST │               │ supabase-js
                       (mutations,     │               │ (auth + safe
                        scoring, etc.) │               │  reads via RLS,
                                       │               │  Realtime push)
                                       ▼               ▼
                            ┌────────────────┐    ┌────────────────────┐
                            │      GCP       │    │     SUPABASE       │
                            │  Cloud Run     │    │  - Postgres 15     │
                            │  (backend API) │    │  - Supabase Auth   │
                            │  + workers     │◄───┤  - Storage         │
                            │  + cron        │    │  - Realtime        │
                            │  + webhooks    │    └────────────────────┘
                            └────┬───────────┘
                                 │
                                 ▼
                            ┌────────────────┐    ┌────────────────────┐
                            │ Upstash Redis  │    │      Resend        │
                            │ (idempotency,  │    │  (transactional    │
                            │  rate limits,  │    │   email + SMTP for │
                            │  scan locks)   │    │   Supabase Auth)   │
                            └────────────────┘    └────────────────────┘
```

## 1.2 What lives where, and why

| Layer | Platform | What it holds |
|---|---|---|
| **Frontend (Vercel)** | Next.js App Router | All UI, attendee + admin + staff routes, middleware, the slug guard, lightweight server components. The browser uses `@supabase/supabase-js` directly for **auth** and for **safe reads** (leaderboard, agenda) that go through Postgres RLS. The browser **never** writes scoring or redemption data — those go to GCP. |
| **Backend (GCP)** | Cloud Run service | All trusted business logic: scoring engine, redemption, William reconciler, exports, webhooks (Calendly), and the background workers. Validates Supabase JWTs on inbound requests. Connects to Supabase Postgres with the **service-role key** (bypasses RLS). Triggered by **Cloud Scheduler** for cron and **Cloud Tasks** for deferred jobs. |
| **Data + auth (Supabase)** | Supabase Cloud | Postgres (every row), Supabase Auth (every login), Storage (sponsor logos, QR PNGs, exports), Realtime (push notifications to attendees). |
| **Email (Resend)** | Resend Cloud | Sends every email: OTPs (via Supabase Auth's SMTP setting), William booking confirmations, export-ready notifications, ops alerts. |
| **Cache (Upstash Redis)** | Upstash | Scan idempotency keys, rate-limit windows, leaderboard cache, OTP throttling. HTTP API — works from Cloud Run and from Vercel Edge if needed. |
| **DNS / WAF (Cloudflare)** | Cloudflare | DNS for `salesgeek.scot`, proxied to Vercel and to the GCP backend. SPF/DKIM/DMARC for the email subdomain. |

## 1.3 Why this split (and not all-Vercel or all-Supabase)

- **Vercel is the right home for Next.js.** Edge, ISR, server components, preview deployments — all first-class.
- **Supabase is the right home for the data plane.** We get Postgres, Auth, Storage, and Realtime as one managed product. No glue.
- **GCP holds the trusted backend** because (a) we already have credits, (b) the scoring/redemption engine needs durable workers, fixed cron, and webhook endpoints that should not share a function pool with the public site, and (c) Cloud Run handles spiky event-day traffic cheaply.
- **The browser only ever talks to Vercel and to Supabase.** It never talks to GCP directly except via the Vercel API — Vercel proxies to GCP under the hood. (Optional later optimization: let the browser call GCP directly for scan endpoints. Day-one keeps it simple — Vercel proxies.)

## 1.4 Request paths (concrete)

**Attendee scans a QR:**

1. Browser opens `https://app.salesgeek.scot/sge-2026/scan/abc?sig=...`.
2. Vercel route handler validates the HMAC signature locally.
3. Vercel calls the GCP backend `POST https://api.salesgeek.scot/scan` with the Supabase access token in `Authorization: Bearer`.
4. GCP validates the JWT against Supabase's JWKS, runs the idempotent scoring transaction against Supabase Postgres (via service-role connection), writes the audit row, returns the result.
5. Vercel relays the result to the browser.
6. The browser's open Supabase Realtime channel receives the score update event and animates the new total — no polling.

**Admin sends a broadcast:**

1. Admin posts to `/admin/notifications/new` on Vercel.
2. Vercel calls GCP `POST /notifications/broadcast`.
3. GCP creates the `notifications` row and enqueues a Cloud Task that fans out per-attendee `notification_recipients` rows in batches.
4. Supabase Realtime emits an insert event on each row.
5. Every attendee's browser, subscribed to its own user's `notification_recipients` channel, receives the message instantly.

**Calendly webhook (William reward):**

1. Calendly sends `POST https://api.salesgeek.scot/webhooks/calendly/<eventSlug>` directly to GCP.
2. GCP validates the HMAC, matches the invitee email to an attendee, completes the redemption transaction in Supabase Postgres.

---

# Part 2 — Accounts & one-time setup

Do all of these once, in this order. They're independent of the code.

## 2.1 What you need on your laptop

| Tool | Version | Why |
|---|---|---|
| Node.js | 20.x LTS | Build and run the Next.js app |
| pnpm | 9.x | Monorepo package manager |
| `gcloud` CLI | latest | Deploy to Cloud Run, manage GCP |
| Git | any recent | Source control |
| A code editor | VS Code / Cursor / similar | Day-to-day work |

```bash
brew install node@20 gcloud
npm install -g pnpm
gcloud auth login
gcloud auth application-default login
```

**No Docker, no Postgres, no Supabase CLI on your laptop.** The database, auth, and storage all live in Supabase Cloud from day one.

## 2.2 Accounts checklist

Create accounts (or get added) on:

| Service | What for | Tier |
|---|---|---|
| **Supabase** (supabase.com) | Postgres + Auth + Storage + Realtime | Free tier for dev, Pro for production |
| **Vercel** (vercel.com) | Next.js hosting | Hobby for dev, Pro for production |
| **Google Cloud** (cloud.google.com) | Cloud Run, Scheduler, Tasks, Secret Manager | Existing credits |
| **Resend** (resend.com) | Transactional email | Free tier covers dev, paid for production volume |
| **Upstash** (upstash.com) | Redis | Free tier covers dev, pay-as-you-go for prod |
| **Cloudflare** (cloudflare.com) | DNS for `salesgeek.scot` | Free |
| **GitHub** | Code | — |

## 2.3 Supabase — create the projects

We use **two Supabase projects** end-to-end:

- `salesgeek-dev` — what we develop against. Throwaway data. SQL is pasted here first.
- `salesgeek-prd` — production. Only touched once a phase's SQL has been validated in dev.

For each project:

1. Sign in to **app.supabase.com** → **New project**.
2. Name (`salesgeek-dev` or `salesgeek-prd`), generate a database password (save in 1Password), pick region **`eu-west-2` (London)**.
3. Wait for provisioning. Copy from **Project Settings**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (Settings → API → Project API keys → service_role; reveal) → `SUPABASE_SERVICE_ROLE_KEY`
     - **Never expose this in the browser.** GCP backend only.
   - **Database connection string** (Settings → Database → Connection string → URI):
     - **Session-mode (port 5432)** for migrations and the GCP backend → `DATABASE_URL`
     - **Transaction-mode pooler (port 6543)** for fast app queries → `DATABASE_POOL_URL`

We will paste SQL into this project via **Dashboard → SQL Editor** during each phase — see Part 6.

(The full Supabase Auth configuration — Resend SMTP, 24h session, anonymous sign-in — is covered in Part 4 once Resend is set up.)

## 2.4 Resend — sign up and start domain verification

We need DNS records to propagate before email works. Start this early.

1. Sign up at **resend.com**.
2. **Domains → Add domain.** Use a subdomain so the apex stays free for other services: `mail.salesgeek.scot`.
3. Resend shows three DNS records (SPF, DKIM, DMARC). Keep this tab open — you'll add the records to Cloudflare in §2.7.

Full details in Part 3.

## 2.5 Upstash Redis — create the database

1. Sign in to **upstash.com** → **Redis → Create Database**.
2. Name: `salesgeek-dev-redis`. Region: **eu-west-2**. TLS: on.
3. Copy from the database page:
   - **REST URL** → `UPSTASH_REDIS_REST_URL`
   - **REST Token** → `UPSTASH_REDIS_REST_TOKEN`

Repeat for `salesgeek-prd-redis` when you're ready to launch.

## 2.6 GCP — create the projects

```bash
gcloud projects create salesgeek-dev --name="SalesGeek Dev"
gcloud projects create salesgeek-prd --name="SalesGeek Prod"
# link billing to use credits
gcloud billing projects link salesgeek-dev --billing-account=<ID>
gcloud billing projects link salesgeek-prd --billing-account=<ID>
```

Enable the APIs we'll need (for each project):

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  --project=salesgeek-dev
```

The actual Cloud Run deploy happens in Phase 0 — for now we just need the project ready.

## 2.7 Cloudflare — DNS

In Cloudflare, for `salesgeek.scot`:

| Record | Type | Value | Purpose |
|---|---|---|---|
| `app` | CNAME | `cname.vercel-dns.com` | Vercel — frontend |
| `api` | CNAME | (Cloud Run URL, set after Phase 0 deploy) | GCP backend |
| `mail` (3 records from Resend) | TXT / MX / CNAME | (from Resend dashboard) | Email SPF/DKIM/DMARC |

For `staging.salesgeek.scot` we do the same with the staging Supabase/Vercel/GCP projects (when we're ready — early phases can run on the dev project alone).

## 2.8 Environment variables you'll need

These end up in three places: your laptop's `.env.local`, Vercel's environment variables (dev + preview + prod), and GCP Secret Manager (backend only).

```env
# Public (browser-safe) — Vercel only
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BACKEND_URL=https://api.salesgeek.scot

# Server-only — Vercel server runtime + GCP backend
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...                  # for backend JWT validation
DATABASE_URL=postgresql://...:5432/...   # session mode (migrations + backend)
DATABASE_POOL_URL=postgresql://...:6543/... # transaction pooler (hot reads)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=...
EMAIL_FROM="SalesGeek Scotland <noreply@mail.salesgeek.scot>"
QR_SIGNING_SECRET=<32 random bytes>
CALENDLY_WEBHOOK_SECRET=...
BACKEND_SHARED_SECRET=<32 random bytes>   # Vercel ↔ GCP HMAC for non-user calls
```

Secrets in GCP go through Secret Manager; secrets in Vercel go through the Environment Variables UI. Never check any of these into git.

---

# Part 3 — Email (Resend) — production setup

Email is mission-critical. Without working delivery, the OTP doesn't arrive and the desk line stops moving. We do this end-to-end from day one — there is no fake inbox.

## 3.1 The sending domain

Use a **dedicated subdomain** for transactional email: `mail.salesgeek.scot`. This isolates reputation from any future marketing email on the apex.

## 3.2 DNS records (the part that takes hours, not minutes)

Resend's Domains page shows three records. They look like this (your values will differ):

| Type | Host | Value | Purpose |
|---|---|---|---|
| TXT | `send.mail.salesgeek.scot` | `v=spf1 include:amazonses.com ~all` | **SPF** — authorizes Resend to send |
| CNAME | `resend._domainkey.mail.salesgeek.scot` | `resend._domainkey.amazonses.com` | **DKIM** — signs your messages |
| TXT | `_dmarc.mail.salesgeek.scot` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@salesgeek.scot` | **DMARC** — anti-spoofing policy |

Add all three to Cloudflare. Click **Verify** in Resend and wait for green checks.

> **Until SPF/DKIM/DMARC are green, do not send to real inboxes.** Gmail and Outlook will silently quarantine OTPs and the desk experience will break. Verify with `mxtoolbox.com/SuperTool.aspx` for SPF/DKIM/DMARC checks.

## 3.3 Wire Resend into Supabase Auth (so OTPs go through Resend)

Supabase Auth has a built-in SMTP relay with a low daily quota — fine for the very first signup test, never fine for an event. Replace it with Resend SMTP before Phase 2.

In each Supabase project: **Authentication → SMTP Settings → Enable Custom SMTP**.

| Field | Value |
|---|---|
| Sender email | `noreply@mail.salesgeek.scot` |
| Sender name | `SalesGeek Scotland` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Minimum interval between emails | `1` second |

Save. Send yourself a test OTP from the Supabase Auth screen and confirm the email arrives via Resend (you'll see it in Resend's **Logs** tab).

## 3.4 Email templates Supabase Auth uses

In Supabase: **Authentication → Email Templates**. We customize:

- **Magic Link** (used for admin/staff login) — content + brand
- **OTP** (used for attendee email login) — content + brand
- **Confirm signup** — disabled, since we use OTP login flow

Templates use Handlebars-style tokens like `{{ .Token }}` and `{{ .SiteURL }}`. Keep them mobile-friendly and short.

## 3.5 Transactional email beyond auth (GCP backend → Resend)

The GCP backend sends a few non-auth emails:

| Trigger | Email |
|---|---|
| William booking confirmed | "Your strategy session is booked — see you on …" |
| Export completed | Admin gets a signed URL to the CSV |
| High-priority broadcast | Optional email mirror of in-app notification |

The backend uses `resend` (Node SDK) directly. Templates are **React Email** components in `apps/backend/email/` so they preview locally.

## 3.6 Email deliverability checks (do this before Phase 9)

- Send a test OTP to a fresh `@gmail`, `@outlook`, `@icloud` inbox. Confirm inbox placement, not spam.
- Run `mail-tester.com` against the sending domain — target score ≥ 9/10.
- Verify DMARC reports arrive at `dmarc@salesgeek.scot`.

---

# Part 4 — Auth (Supabase Auth)

We **drop the custom OTP code** entirely. Supabase Auth handles OTP issue, verify, rate-limit, lockout, JWT, refresh tokens.

## 4.1 Configuration (in Supabase Dashboard, both projects)

**Authentication → Providers → Email:**

- Enable **Email OTP** (passwordless, 6-digit code).
- Disable email signup confirmation (users sign in by OTP — there is no separate "confirm").
- Set **OTP expiry** to 600 seconds (10 minutes).

**Authentication → Sessions:**

- **JWT expiry**: `3600` seconds (1 hour access token — short for safety).
- **Refresh token rotation**: ON.
- **Refresh token reuse interval**: `10` seconds.
- **Inactivity timeout / refresh token TTL**: `86400` seconds (**24 hours**).

What this gives us: the access token rotates every hour silently in the background, and the refresh token is good for 24 hours. From the user's POV, they don't log out for 24 hours of activity. The browser does this with `supabase.auth.startAutoRefresh()` (default-on in `@supabase/supabase-js@2`).

**Authentication → URL Configuration:**

- Site URL: `https://app.salesgeek.scot` (and the dev/preview equivalents).
- Redirect allow-list: production + Vercel preview domains.

**Authentication → Providers → Anonymous sign-ins:** **enable.** We use this for the pre-OTP "enter the app before verifying" flow (Phase 2).

## 4.2 The auth flow we ship

The spec says attendees can enter the app before verification (to keep the registration desk moving). With Supabase Auth this becomes:

1. **Attendee scans desk QR or visits the join URL.** The browser immediately calls `supabase.auth.signInAnonymously()`. They are now logged in as an anonymous user with a unique `auth.users.id` — they can see the app and have a session.
2. **At their leisure they enter their email.** Browser calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. OTP arrives via Resend.
3. **They paste the OTP.** Browser calls `supabase.auth.verifyOtp(...)`. The anonymous user is **linked/upgraded** to a verified email user (Supabase does this in-place when an anonymous user verifies). Their `auth_user_id` does not change; their data carries over.
4. **`public.users` row** is created automatically by the trigger in our SQL — the new `auth.users` row fires `handle_new_auth_user()` which inserts into `public.users` with `type = 'attendee'`.
5. **Pre-signup QR scans** are stored against the anonymous `auth_user_id`. After OTP verification, no replay step is needed — the same user is just now verified.

What "verified" means for prize eligibility: an `attendees.is_verified` flag is set when the user transitions from anonymous to email-verified (we listen for the `auth.users.is_anonymous` flip).

## 4.3 Admin / staff login

Same `signInWithOtp` flow with **magic link** instead of code. Their `public.users.type` is `admin` or `staff` — set by an admin via the backend, not derivable from auth.

## 4.4 Validating Supabase JWTs in the GCP backend

The GCP backend receives `Authorization: Bearer <access_token>` on every Vercel-proxied request. It validates the JWT using **`SUPABASE_JWT_SECRET`** (from Supabase Dashboard → Settings → API → JWT Secret). On valid, it extracts `sub` (the auth user id), looks up `public.users` by `auth_user_id`, and attaches role + attendee record to the request context.

```ts
// Sketch of the middleware in apps/backend/src/middleware/auth.ts
import { jwtVerify } from 'jose';
const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
// payload.sub === auth.users.id
```

---

# Part 5 — Notifications (the full system)

Three layers. All shipped together in Phase 7.

## 5.1 In-app notifications (the source of truth)

- Table `notifications` (the broadcast): title, body, audience filter, scheduled_at, created_by.
- Table `notification_recipients` (one row per attendee per notification): delivered_at, read_at.
- Admin creates a broadcast → GCP backend creates the `notifications` row → enqueues a Cloud Task that fans out per-attendee `notification_recipients` rows in batches of 500.

## 5.2 Realtime push (delivery, no polling)

- Supabase Realtime is enabled on `notification_recipients` (publication adds inserts only — not the whole row history).
- The attendee browser, on login, opens a Realtime subscription:
  ```ts
  supabase.channel(`notifs:${userId}`)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_recipients',
          filter: `attendee_id=eq.${userId}` },
        (payload) => addNotification(payload.new))
    .subscribe();
  ```
- Result: zero-latency delivery, no polling, no battery drain.
- Fallback: a 60-second poll on focus, in case the WebSocket was dropped.

## 5.3 Email mirror (for high-priority broadcasts only)

- Admin's broadcast form has a checkbox: "**Also send by email**".
- If on, the fan-out task batches Resend `batch.send` calls (Resend supports up to 100 recipients per call).
- Delivery status comes back via Resend's webhook into the GCP backend and is recorded on `notification_recipients`.

## 5.4 Scheduled broadcasts

- Set `scheduled_at` in the future. The row sits in `notifications` until due.
- **Cloud Scheduler** fires the GCP backend `POST /jobs/notifications-due` every minute. The job picks up any rows where `scheduled_at <= now()` and not yet dispatched, then fans them out exactly like an immediate broadcast.

## 5.5 William reconciliation (related background system)

The same job runner handles the William reward webhook reconciler: every 5 minutes Cloud Scheduler kicks `POST /jobs/william-reconcile`, which queries Calendly for any pending bookings that haven't been webhooked back yet, and completes the redemption.

---

# Part 6 — The `supabase/sql/` folder

## 6.1 Convention

Every phase that touches the database ships **one SQL file** in `supabase/sql/`. The numeric prefix is the paste order.

```
supabase/
  sql/
    README.md
    0000_extensions.sql
    0001_phase0_foundation.sql
    0002_phase1_multi_event.sql
    0003_phase2_identity.sql
    0004_phase3_content.sql
    0005_phase4_business_qr.sql
    0006_phase5_scoring.sql
    0007_phase6_rewards.sql
    0008_phase7_notifications.sql
    0009_phase8_archive.sql
    0010_storage_buckets.sql
```

**The folder is built up phase by phase as we implement each phase. We do not pre-write all the SQL up front** — the SQL is written together with the app code that uses it, so the schema and the code stay aligned.

Each SQL file must be:

- **Idempotent.** Use `create table if not exists`, `create index if not exists`, `do $$ ... exception when duplicate_object then null; end $$;` for enums. Running the same file twice is safe.
- **Self-contained.** Includes table DDL, indexes, constraints, RLS enable, and any triggers introduced in that phase.
- **RLS-on by default.** Every table has Row Level Security enabled with **no default policies** — only the `service_role` (used by GCP backend) can read/write. Where we need browser-direct reads (leaderboard, agenda, events_public), we add **explicit select policies** for the `anon` and `authenticated` roles in the same file.

## 6.2 How to apply a phase's SQL

1. Open **app.supabase.com** → your dev project → **SQL Editor → New query**.
2. Open the phase's `.sql` file in the repo.
3. Paste, click **Run**. The Editor shows any errors with line numbers.
4. Once dev is green, repeat the paste against the prod project at production cutover (Part 8).

## 6.3 Types in the app

The frontend (Vercel) uses `@supabase/supabase-js` typed via **`supabase gen types typescript`** run **once per phase** against the dev project — but you can also generate via the Dashboard's "Generate types" button. No CLI is strictly required. Generated types live in `packages/contracts/db-types.ts`.

The GCP backend uses **Drizzle ORM** with hand-written TypeScript schema definitions in `apps/backend/src/db/schema.ts`. Drizzle stays the source of typed-query truth on the backend; the SQL files in `supabase/sql/` stay the source of schema truth in Postgres. We keep them in sync by treating SQL as canonical and updating Drizzle to match each phase.

---

# Part 7 — The phased build

> **Rule of the road:** A phase is closed only when:
> 1. All listed P0 test cases pass on your laptop.
> 2. `pnpm test && pnpm typecheck && pnpm lint` is green.
> 3. The phase's smoke script (each phase ships one) returns exit code 0.
> 4. Non-negotiables are visibly enforced (you wrote a test that proves it).

---

## Phase 0 — Foundation (Day 1, 12 May)

### What we're building
The empty house. A monorepo that boots, a Vercel project linked to GitHub, a GCP Cloud Run backend that responds on `/health`, and a Supabase project holding the first tables. End-to-end across all three platforms before any feature lands.

### SQL to paste
Write `supabase/sql/0000_extensions.sql` (enables `pgcrypto`, `uuid-ossp`, `pg_trgm`, `btree_gin`) and `supabase/sql/0001_phase0_foundation.sql` (creates `events`, `users`, `audit_logs`, with RLS on and an auto-sync trigger from `auth.users → public.users`). Paste both into Supabase Dashboard → SQL Editor → Run, against the **dev** project.

### Files & repo layout
- `apps/web/` — Next.js 14 App Router (deployed to Vercel)
- `apps/backend/` — Hono server on Cloud Run (GCP backend)
- `apps/backend/Dockerfile` — multi-stage Node 20 build
- `packages/domain/` — pure domain logic, imported by `apps/backend`
- `packages/contracts/` — Zod schemas + generated Supabase types
- `supabase/sql/` — pasted-in SQL migrations (start populating in this phase)
- `.env.example` — every env var the app/backend needs
- `infra/gcp/` — Terraform or gcloud scripts for Cloud Run, Scheduler, Tasks

### How to build it (step-by-step)

1. **Scaffold the monorepo.** pnpm workspaces + Turborepo. Root `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
2. **Create the Next.js app.** `pnpm create next-app@14 apps/web --typescript --app --tailwind --eslint`. Strip the demo content. Add `@supabase/supabase-js` and a `lib/supabase-browser.ts` helper that creates the client with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Create the backend.** `apps/backend/` is a small **Hono** server (lightweight Express alternative, great on Cloud Run). Routes: `GET /health`, plus a JWT validation middleware that decodes the Supabase access token using `SUPABASE_JWT_SECRET`. Connect to Postgres via **Drizzle ORM** using `DATABASE_URL` (session-mode connection).
4. **Paste the SQL.** Open the dev Supabase project's SQL Editor and run `0000_extensions.sql` then `0001_phase0_foundation.sql`. Verify tables exist via **Table Editor**.
5. **Generate types.** In Supabase Dashboard → API → "Generate types" → TypeScript. Save the output to `packages/contracts/db-types.ts`. (No CLI required — the dashboard gives you a copy-pasteable file.)
6. **Wire the Drizzle schema.** In `apps/backend/src/db/schema.ts`, write Drizzle table definitions matching the SQL you pasted. This is hand-maintained; the SQL stays canonical.
7. **Implement the audit pattern.** `packages/domain/audit.ts` exports `withAudit(tx, actor, action, target, reason, fn)` — wraps a Drizzle transaction, runs `fn`, then inserts an `audit_logs` row in the same transaction. Every later mutation uses this.
8. **RBAC.** `packages/domain/rbac.ts` exports `canDoAction(actor, action, resource)`. A backend middleware `requireRole(...roles)` runs after JWT validation.
9. **Deploy backend to Cloud Run.** First deploy from local: `gcloud builds submit --tag europe-west2-docker.pkg.dev/salesgeek-dev/svc/backend:v0 ./apps/backend`, then `gcloud run deploy backend --image ... --region europe-west2 --allow-unauthenticated=false`. Bind secrets from Secret Manager. Note the service URL — point Cloudflare `api.salesgeek.scot` at it.
10. **Deploy Vercel frontend.** Connect repo on Vercel, set environment variables (Part 2.8), trigger first deploy. Vercel handles the `app.salesgeek.scot` DNS.
11. **CI.** `.github/workflows/ci.yml` runs `pnpm typecheck && pnpm lint && pnpm test`. Vercel and Cloud Build do the deploys on merge.

### Health check end-to-end
- `https://app.salesgeek.scot/health` — Vercel responds OK.
- `https://api.salesgeek.scot/health` — Cloud Run responds OK (returns Git SHA + Postgres reachability bool).
- Frontend `lib/supabase-browser.ts` can `select` from `events_public` (empty array, but no auth error).

### Scripts to create

1. **[scripts/db-truncate.ts](../scripts/db-truncate.ts)** — for the dev Supabase project only: connects via `DATABASE_URL`, truncates every app table (except `auth.*`), resets sequences. Used before re-seeding. Refuses to run if the project URL contains `prd`.
2. **[scripts/seed-base.ts](../scripts/seed-base.ts)** — connects to dev Supabase via service-role, inserts one event (`sge-2026`), one admin user, one staff user. Idempotent (uses `on conflict do nothing`).
3. **[scripts/smoke.ts](../scripts/smoke.ts)** — pings both `app.salesgeek.scot/health` and `api.salesgeek.scot/health`, asserts 200, exits 0/1. Takes `--env=dev|prd` flag.
4. **[scripts/test-audit.ts](../scripts/test-audit.ts)** — calls a `withAudit` write through a backend test endpoint, queries `audit_logs`, asserts one row. Also runs the call but forces an exception inside `fn`, asserts no audit row leaked (transactional integrity).
5. **[scripts/test-rbac.ts](../scripts/test-rbac.ts)** — generates a JWT for a fake staff user, calls an admin-only backend endpoint, asserts 403. Same with an admin JWT — asserts 200.
6. **[scripts/gen-types.sh](../scripts/gen-types.sh)** — convenience: open Supabase Dashboard's type generator URL for the dev project (saves clicking through). Manual paste into `packages/contracts/db-types.ts`.

`package.json`:
```json
"scripts": {
  "dev:web": "pnpm --filter web dev",
  "dev:backend": "pnpm --filter backend dev",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "db:truncate": "tsx scripts/db-truncate.ts",
  "db:seed": "tsx scripts/seed-base.ts",
  "smoke": "tsx scripts/smoke.ts",
  "test:audit": "tsx scripts/test-audit.ts",
  "test:rbac": "tsx scripts/test-rbac.ts"
}
```

### How to test it
```bash
# 1. Paste 0000 + 0001 SQL into dev Supabase project.
# 2. Locally:
pnpm install
pnpm db:truncate    # safe-noop if empty
pnpm db:seed
pnpm dev:backend &  # backend runs locally pointed at dev Supabase
pnpm dev:web &      # web runs locally pointed at dev Supabase + local backend
sleep 5
pnpm smoke --env=dev
pnpm test:audit
pnpm test:rbac
pnpm test           # vitest unit suite
pnpm typecheck
pnpm lint
```

### Test gate (must all pass to open Phase 1)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] `pnpm smoke --env=dev` returns 0 (both Vercel and Cloud Run healthy)
- [ ] `pnpm test:audit` returns 0
- [ ] `pnpm test:rbac` returns 0
- [ ] `0000_extensions.sql` + `0001_phase0_foundation.sql` applied cleanly in dev Supabase project; tables visible in Table Editor
- [ ] Frontend can read `events_public` from the browser (RLS-permitted)
- [ ] Backend rejects requests without a valid Supabase JWT

### Non-negotiables
- No mutation function exists outside `withAudit`. Grep `apps/backend/src` for direct `db.insert`/`db.update` outside the `withAudit` wrapper — there should be none in domain code.
- The `audit_logs` table is **append-only**. No domain code calls `update` or `delete` on it (also revoked at the SQL level for non-service-role).
- The `service_role` key never reaches the browser. It's only in GCP Secret Manager and Vercel's server-side env vars.

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

## Phase 2 — Identity, Supabase Auth, check-in (Day 3, 14 May)

### What we're building
Attendees enter the app instantly as **anonymous Supabase users** (so the desk line moves), then upgrade to a verified email user by entering an OTP delivered via **Resend → Supabase Auth**. Session stays logged in for **24 hours**. Auto-check-in fires on first event-day entry. Email is canonical and immutable.

> We drop the custom OTP code entirely. Supabase Auth handles OTP issue, verify, rate-limit, lockout, JWT, and refresh.

### SQL to paste
Write and paste `supabase/sql/0003_phase2_identity.sql`:
- `attendees` (event_id, user_id, email, real_name, business_name, phone, alias, is_verified, checked_in_at, competition_score, spendable_balance, reached_current_score_at)
- `pending_scans` (auth_user_id, qr_code_id, created_at) — survives the anon-to-verified upgrade because `auth_user_id` stays the same
- Trigger: when `auth.users.is_anonymous` flips from `true` to `false`, set `attendees.is_verified = true` and fire an "identity_verified" audit row
- RLS: `attendees` has a `select` policy where `auth_user_id = auth.uid()` so each attendee can read **only their own** row from the browser; writes still go through the GCP backend

### Supabase Dashboard config (one-time per project)
This is the actual config — already covered in Part 4, called out again here since it lands in Phase 2:

- **Authentication → Providers → Email**: enable Email OTP, OTP length 6, expiry 600s.
- **Authentication → Providers → Anonymous sign-ins**: enable.
- **Authentication → Sessions**: JWT expiry 3600s, refresh token TTL **86400s (24h)**, rotation on.
- **Authentication → SMTP**: custom SMTP via Resend (Part 3.3 already done).
- **Authentication → Rate Limits**: confirm OTP issue rate limit (default: 360/hour per IP; tighten per attendee via Upstash if needed).

### How to build it

1. **Anonymous sign-in on first hit.** In `apps/web/app/[eventSlug]/layout.tsx`, on first load: if `supabase.auth.getSession()` is null, call `supabase.auth.signInAnonymously()`. The user now has an `auth_user_id` and a JWT. The session cookie is stored by `@supabase/ssr` and refreshes silently.
2. **Create the `attendees` row.** The backend exposes `POST /attendees/upsert` that takes `{ event_id, real_name?, business_name?, phone? }`, finds-or-creates an `attendees` row keyed by `(event_id, auth_user_id)`. Called once after anonymous sign-in.
3. **The signup form.** Single-screen mobile form: email (required), real name, business name, phone. On submit, browser calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. Resend delivers the 6-digit code.
4. **OTP entry.** Single input. Browser calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`. On success, the anonymous user is upgraded in-place to a verified email user (same `auth.users.id`). The trigger flips `attendees.is_verified = true`.
5. **Email immutability.** Backend `POST /attendees/update` validates that `email` is **not** in the payload (or returns 403). At the SQL level, RLS denies writes; only service-role can update, and the backend domain layer refuses email changes.
6. **Auto-check-in.** Backend middleware: on every authenticated request, if `event.lifecycle_state = 'event_day'` and `attendees.checked_in_at IS NULL`, set `checked_in_at = now()` in a single `update ... where checked_in_at is null` (idempotent under concurrent requests).
7. **24-hour session.** Already configured in Supabase (Part 4). The `supabase-js` client auto-refreshes the access token using the refresh token. No app code needed.
8. **Pre-signup scan capture.** When an anonymous user hits `/scan/<code>`, the backend records `pending_scans(auth_user_id, qr_code_id)`. Because the upgrade to verified keeps the same `auth_user_id`, **no replay is needed** — at scoring time we treat verified and unverified the same, except we tag the award with `is_verified` so we can compute prize eligibility at archive time.

### Scripts to create
1. **[scripts/seed-attendees.ts](../scripts/seed-attendees.ts)** — uses the Supabase Admin API (`supabase.auth.admin.createUser`) to create 20 verified attendees and their `attendees` rows. Idempotent.
2. **[scripts/test-supabase-auth-flow.ts](../scripts/test-supabase-auth-flow.ts)** — full happy path: anonymous sign-in → upsert attendee → request OTP → fetch from **Resend's API** (`GET /emails/<id>` once Resend webhook fires, or use Resend's recent-emails endpoint) → verify OTP → assert `is_verified=true` and `auth_user_id` unchanged.
3. **[scripts/test-24h-session.ts](../scripts/test-24h-session.ts)** — issues an access token, fast-forwards Vitest fake clock 23h, asserts a refresh succeeds; 25h, asserts refresh fails.
4. **[scripts/test-checkin.ts](../scripts/test-checkin.ts)** — set event to `event_day`, call a backend route as an attendee, assert `checked_in_at` set; second call, assert unchanged.
5. **[scripts/test-email-immutability.ts](../scripts/test-email-immutability.ts)** — call `POST /attendees/update` with an `email` field, assert 403.
6. **[scripts/test-anon-to-verified.ts](../scripts/test-anon-to-verified.ts)** — sign in anonymously, capture `auth_user_id`, verify with OTP, assert same `auth_user_id` and `is_verified` now true.
7. **[scripts/test-presignup-scan.ts](../scripts/test-presignup-scan.ts)** — anon scan, sign up + verify, assert the scan is attributed to the now-verified attendee with no replay step.

`package.json` additions:
```json
"test:auth": "tsx scripts/test-supabase-auth-flow.ts",
"test:session-24h": "tsx scripts/test-24h-session.ts",
"test:checkin": "tsx scripts/test-checkin.ts",
"test:email-immutable": "tsx scripts/test-email-immutability.ts",
"test:anon-to-verified": "tsx scripts/test-anon-to-verified.ts",
"test:presignup": "tsx scripts/test-presignup-scan.ts"
```

### How to test it
```bash
# Paste 0003_phase2_identity.sql into dev Supabase project first.
pnpm db:truncate && pnpm db:seed
tsx scripts/seed-attendees.ts
pnpm dev:backend &
pnpm dev:web &
sleep 5
pnpm test:auth
pnpm test:session-24h
pnpm test:anon-to-verified
pnpm test:checkin
pnpm test:email-immutable
pnpm test:presignup
```

Manual smoke (do once):
- Open the deployed dev URL `/sge-2026/join` on your phone.
- You're already logged in anonymously — no friction.
- Enter your real email, request OTP. Email arrives via Resend within seconds.
- Paste OTP. Now verified.
- Close the tab, reopen 12 hours later — still logged in.

### Test gate
- [ ] Anonymous sign-in happens silently on first app entry.
- [ ] OTP delivered via Resend (verify in Resend → Logs).
- [ ] Verification upgrades the anonymous user in place (same `auth_user_id`).
- [ ] Refresh token TTL of 24h: user is not logged out within that window.
- [ ] First event-day request sets `checked_in_at`; second call does not change it.
- [ ] `email` field in any `POST /attendees/update` payload is rejected.
- [ ] A pre-verification scan is correctly attributed to the same attendee after verification.

### Non-negotiables
- App entry works **before** OTP verification (anonymous sign-in handles this).
- Email immutability enforced server-side and at the SQL trigger level.
- Session lifetime is 24 hours — refresh tokens are configured at the Supabase project level, not in app code.

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
6. **Asset storage via Supabase Storage.** Create two buckets in `supabase/config.toml`:
    - `assets` — sponsor logos, geek photos, speaker headshots (signed URLs, 1h TTL).
    - `qr-cards` — generated print PNG/ZIP exports.

    Locally these live in Supabase's bundled storage container; in production we point at the same buckets on Supabase Cloud. The `@supabase/supabase-js` client (using the service-role key, server-side only) handles uploads.

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
1. **Streaming CSV.** Use `pg-query-stream` with `COPY (SELECT ...) TO STDOUT WITH CSV HEADER`. Keeps memory flat. For large exports, stream the CSV into a Supabase Storage `exports` bucket and return a signed download URL; small exports stream straight to the response.
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

# Part 8 — Production cutover

Because we develop against real cloud (dev Supabase + dev Vercel + dev GCP) from day one, "going to production" is not a giant migration. It is a controlled **promotion**: same code, same SQL, against the prod set of projects.

## 8.1 Production projects to create (once, ahead of cutover)

| Service | Dev project | Prod project |
|---|---|---|
| Supabase | `salesgeek-dev` | `salesgeek-prd` |
| Vercel | `salesgeek` (Preview + Production envs) | same project, prod branch is `main` |
| GCP | `salesgeek-dev` | `salesgeek-prd` |
| Upstash Redis | `salesgeek-dev-redis` | `salesgeek-prd-redis` |
| Resend | shared, same sending domain (`mail.salesgeek.scot`) | same |

## 8.2 Promotion steps

1. **Apply all SQL files to the prod Supabase project** in order (`0000` → `0010`). Verify in Table Editor.
2. **Configure prod Supabase Auth** exactly as dev: Email OTP, anonymous sign-in enabled, Resend SMTP, 24-hour refresh TTL, redirect allow-list points at `app.salesgeek.scot`.
3. **Deploy the backend to prod Cloud Run.** Same image tag as the green dev deploy. Bind prod secrets from Secret Manager.
4. **Point Cloudflare `api.salesgeek.scot`** at the prod Cloud Run URL.
5. **Promote Vercel to production.** Merge to `main`. Vercel auto-deploys. `app.salesgeek.scot` resolves.
6. **Smoke test prod.** `pnpm smoke --env=prd`. Run the full Playwright happy-path against prod.
7. **Seed minimum prod data.** Real event (`sge-2026`), real admin/staff accounts, real businesses, real reward catalog. Done via dashboard-only or `scripts/seed-prod-event.ts` running locally with prod env vars (extreme care: refuses if `--confirm` not passed).
8. **Pre-event freeze.** No code merges in the 48 hours before event day except incident fixes.

## 8.3 Day-of operations (separate runbook)

The detailed event-day playbook (T-48h, T-24h, T-2h, T-0, escalation rota) is intentionally out of this doc. It belongs in `Docs/event-day-runbook.md`, written once Phase 9 is green.

---

# Appendix A — The scripts you'll have at the end of Phase 9

By the end of the build, your `scripts/` folder looks like this:

```
scripts/
├── db-truncate.ts
├── smoke.ts
├── full-uat.ts
├── load-summary.ts
├── security-check.ts
├── gen-types.sh
├── seed-base.ts
├── seed-events.ts
├── seed-attendees.ts
├── seed-businesses.ts
├── seed-content.ts
├── seed-qrs.ts
├── seed-rewards.ts
├── simulate-calendly-webhook.ts
├── run-worker-locally.ts
├── test-audit.ts
├── test-rbac.ts
├── test-event-isolation.ts
├── test-lifecycle.ts
├── test-branding.ts
├── test-slug-404.ts
├── test-supabase-auth-flow.ts
├── test-24h-session.ts
├── test-anon-to-verified.ts
├── test-checkin.ts
├── test-email-immutability.ts
├── test-presignup-scan.ts
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

# Appendix B — Phase calendar at a glance

| Day | Date | Phase | What "done" looks like |
|---|---|---|---|
| 1 | Tue 12 May | Phase 0 | Vercel + Cloud Run + dev Supabase all respond on `/health`; SQL `0000` + `0001` applied |
| 2 | Wed 13 May | Phase 1 | Slug routing works; lifecycle transitions tested; SQL `0002` applied |
| 3 | Thu 14 May | Phase 2 | Anon sign-in → OTP via Resend → 24h session round-trip; SQL `0003` applied |
| 4–6 | Fri–Sun 15–17 May | Phase 3 | Five-tab IA visible, content CRUD works; SQL `0004` applied |
| 7 | Mon 18 May | Phase 4 | Business QR auto-created, signed, immutable; SQL `0005` + `0010` (storage) applied |
| 8–11 | Tue–Fri 19–22 May | Phase 5 | 100-parallel scan test passes, leaderboard is anonymous; SQL `0006` applied |
| 11–12 | Fri–Sat 22–23 May | Phase 6 | William webhook completes redemption; oversell test passes; SQL `0007` applied |
| 13 | Sun 24 May | Phase 7 | Realtime notifications + ops dashboard; SQL `0008` applied |
| 14 | Mon 25 May | Phase 8 | Real-time exports + archive controls work; SQL `0009` applied |
| 14 | Mon 25 May | Phase 9 | Load + security + UAT green |
| 15 | Tue 26 May | — | **Production cutover (Part 8) — event day** |

# Appendix C — Glossary

- **Idempotent.** Same input, same outcome — calling the function twice does not produce two awards.
- **Audit row.** A line in the `audit_logs` table that says "this actor did this thing at this time, here's the payload". Never updated, never deleted.
- **Ledger.** A running balance. We have two: `competition_score` (for the leaderboard) and `spendable_balance` (for redemptions).
- **HMAC.** A signature using a shared secret. Stops an attacker from making up QR URLs.
- **RLS (Row Level Security).** Postgres feature that enforces per-row access at the database level. We enable it on every table; the GCP backend uses the service-role key (bypasses RLS), the browser uses the anon/authenticated keys (subject to RLS).
- **Anonymous sign-in.** Supabase Auth feature that gives an unverified user a `auth.users` row + JWT immediately. Lets us keep the desk line moving and upgrade to verified on OTP.
- **Realtime.** Supabase service that streams Postgres row changes to subscribed browsers via WebSocket. We use it to push notifications and score updates without polling.
- **Resend.** Transactional email provider. Powers both Supabase Auth OTP emails (via SMTP) and our app's non-auth emails (via API).
- **Service-role key.** Supabase's "god mode" key that bypasses RLS. Only ever lives in GCP Secret Manager and Vercel server-side env vars.
- **k6.** Load testing tool. We run it against the dev cloud stack in Phase 9.
- **Playwright.** Browser automation. We script real user flows against the deployed dev URL.
- **Test gate.** The list of test cases that must pass for the phase to count as "done". No exceptions.

---

*End of phased implementation plan.*
