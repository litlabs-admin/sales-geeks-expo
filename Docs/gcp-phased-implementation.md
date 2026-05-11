# SalesGeek Scotland — Phased Implementation Plan
## Scottish Growth Expo 2026 — Event Companion Web App

> **Stance.** Build and run the entire app **locally** until every phase test gate is green. The only services that are real from day one are **Supabase** (data + auth) and **Resend** (email) — both used straight against their cloud APIs. Vercel and GCP do not exist yet during the build; they appear only in the final deployment phase.

> **Why this hybrid?** Data and email are the two things you cannot mock convincingly. By using real Supabase and real Resend from day one we get genuine OTP delivery, real RLS behavior, real Realtime, and zero parity drift. Everything else (frontend, backend, Redis) runs on your laptop where iteration is instant.

> **SQL workflow.** Every phase that touches the database ships one SQL file in `supabase/sql/`. You paste it into **Supabase Dashboard → SQL Editor → Run**. The folder is built up phase by phase as we go — we are not pre-writing all migrations.

> **Sources of truth for scope:** [northstar.md](../northstar.md), [docs/read.md](../read.md), [deliverables.md](../deliverables.md).

---

## How this document is organized

1. **Part 1 — Architecture.** What runs where during local development, and what production will look like after Phase 10.
2. **Part 2 — Accounts & local setup.** Supabase + Resend cloud accounts, Cloudflare for email DNS, plus the laptop tools (Node, pnpm, Docker for local Redis).
3. **Part 3 — Email (Resend).** Production sending domain, DNS (SPF/DKIM/DMARC), and how Resend powers Supabase Auth emails. Real emails from day one.
4. **Part 4 — Auth (Supabase Auth).** Email OTP, 24-hour session, anonymous sign-in for the pre-OTP app entry flow.
5. **Part 5 — Notifications.** In-app + Realtime + email — the full three-layer system.
6. **Part 6 — The SQL folder.** Convention for `supabase/sql/` and how phases use it.
7. **Part 7 — The phased build (local).** Phases 0 through 9. Every phase has:
   - **What we're building** (plain English)
   - **SQL to paste** (file in `supabase/sql/`)
   - **Frontend changes** (`apps/web` — Next.js dev server)
   - **Backend changes** (`apps/backend` — Hono running locally)
   - **Scripts to create**
   - **How to test it** (all local commands)
   - **Test gate**
   - **Non-negotiables**
8. **Part 8 — Deployment (Phase 10).** Only after Phase 9 is green. Vercel for the frontend, GCP Cloud Run for the backend, Upstash for production Redis, prod Supabase project, prod Resend domain.

---

# Part 1 — Architecture

## 1.1 During local development (Phases 0–9)

```
┌──────────────────────────────────────────────────────────────────┐
│  Your laptop                                                     │
│                                                                  │
│   pnpm dev:web      (Next.js dev server  → http://localhost:3000)│
│   pnpm dev:backend  (Hono server         → http://localhost:8080)│
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │  Docker Compose (we own this — just Redis)                 │ │
│   │   - redis           :6379   (cache, rate limit, queue)     │ │
│   └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ HTTPS (only data + email leave the laptop)
                                   ▼
              ┌────────────────────────────────────────────┐
              │             Supabase Cloud (dev project)   │
              │  - Postgres 15                             │
              │  - Supabase Auth (Email OTP via Resend)    │
              │  - Storage (assets, qr-cards, exports)     │
              │  - Realtime (notification push)            │
              └────────────────────────────────────────────┘
              ┌────────────────────────────────────────────┐
              │             Resend Cloud                   │
              │  - Sends every email (OTPs, confirmations) │
              │  - mail.salesgeek.scot sending domain      │
              └────────────────────────────────────────────┘
```

**What runs locally:** Next.js frontend, Hono backend, Redis.
**What runs in the cloud (from day one):** Supabase, Resend.
**What does NOT exist yet:** Vercel, GCP Cloud Run, Upstash Redis, Cloudflare proxy. Those appear in Phase 10.

## 1.2 After deployment (Phase 10 onward — the production view)

```
                                ┌──────────────────────────────┐
                                │      User (mobile browser)   │
                                └──────────────┬───────────────┘
                                               │ HTTPS via Cloudflare
                                               ▼
                              ┌────────────────────────────────┐
                              │           VERCEL               │
                              │   Next.js 14 — app.salesgeek   │
                              └────────┬───────────────┬───────┘
                                       │               │
                                       ▼               ▼
                            ┌────────────────┐    ┌────────────────────┐
                            │  GCP Cloud Run │    │   Supabase Cloud   │
                            │  api.salesgeek │    │   (prod project)   │
                            └────┬───────────┘    └────────────────────┘
                                 │                          ▲
                                 ▼                          │
                            ┌────────────────┐              │
                            │ Upstash Redis  │              │
                            └────────────────┘              │
                                                            │
                                          ┌─────────────────┘
                                          │
                                  ┌───────────────┐
                                  │    Resend     │
                                  └───────────────┘
```

The shape is the same as local development; we just swap **localhost** for **Vercel + Cloud Run + Upstash**. Same Supabase, same Resend.

## 1.3 What lives where, and why

| Layer | Local (Phases 0–9) | Production (Phase 10) | What it holds |
|---|---|---|---|
| **Frontend** | `pnpm dev:web` on :3000 | Vercel | All UI; talks to Supabase directly for auth + safe reads, talks to backend for trusted writes |
| **Backend** | `pnpm dev:backend` on :8080 | GCP Cloud Run | Scoring, redemption, exports, webhooks, workers, cron |
| **Data + auth** | Supabase Cloud (dev project) | Supabase Cloud (prod project) | Postgres + Auth + Storage + Realtime |
| **Email** | Resend Cloud (real sends to a test inbox) | Resend Cloud (real sends to real attendees) | OTPs + transactional |
| **Cache / queue** | Docker Redis on :6379 | Upstash Redis | Idempotency, rate limits, queue |
| **DNS / TLS** | none needed | Cloudflare in front of Vercel + Cloud Run | — |

## 1.4 Why this hybrid, not pure-local

- **Supabase Auth + OTP delivery + RLS + Realtime cannot be faithfully mocked.** Running them against Supabase Cloud from day one means the auth flow you build is the auth flow that ships. No "but it worked locally" surprises.
- **Resend's deliverability behavior is the hardest thing to debug post-launch.** Sending real emails into real inboxes from week one shaves off the 1-hour DNS troubleshooting session on event day.
- **Everything else** (frontend, backend, Redis) is faster, cheaper, and easier to debug on your laptop. So they stay local.

## 1.5 Request paths (concrete, local)

**Attendee scans a QR (local dev):**

1. Browser opens `http://localhost:3000/sge-2026/scan/abc?sig=...`.
2. Next.js dev server's route handler validates the HMAC signature.
3. Frontend calls the local backend `POST http://localhost:8080/scan` with the Supabase access token.
4. Local backend validates the JWT (against Supabase's JWT secret), runs the idempotent scoring transaction against **Supabase Cloud Postgres** (via service-role), writes the audit row.
5. The browser's open **Supabase Realtime** channel (subscribed to Supabase Cloud directly) receives the score update event.

**Admin sends a broadcast (local dev):**

1. Admin posts to `localhost:3000/admin/notifications/new`.
2. Frontend calls `localhost:8080/notifications/broadcast`.
3. Backend creates the `notifications` row in **Supabase Cloud**, then either fans out inline (small audience) or pushes to a local Redis queue that a backend worker drains.
4. Supabase Realtime emits insert events on the new `notification_recipients` rows.
5. Every attendee's browser (subscribed to Supabase Cloud Realtime) sees it instantly.

**Calendly webhook (local dev):**

Calendly cannot reach `localhost`. For the William reward flow we use a tunneling tool (`cloudflared tunnel`, `ngrok`, or `tailscale serve`) to expose `localhost:8080/webhooks/calendly/...` on a temporary public URL during testing. The `scripts/simulate-calendly-webhook.ts` script bypasses the tunnel entirely by posting a signed fake payload directly to the local backend.

---

# Part 2 — Accounts & local setup

Two cloud accounts, a small DNS change, and a handful of laptop tools. Do these once before Phase 0.

## 2.1 Laptop tools

| Tool | Version | Why |
|---|---|---|
| Node.js | 20.x LTS | Run Next.js and the backend |
| pnpm | 9.x | Monorepo package manager |
| Docker Desktop or OrbStack | latest | Run local Redis |
| Git | any recent | Source control |
| `psql` client | 15.x | Poke Supabase directly when debugging |
| A code editor | VS Code / Cursor / similar | Day-to-day work |

```bash
brew install node@20 libpq
brew link --force libpq
npm install -g pnpm
brew install --cask orbstack
```

That's it. **No `gcloud` CLI, no Vercel CLI, no Supabase CLI until Phase 10** — none are needed for local development.

## 2.2 Cloud accounts you need from day one

| Service | What for | Free tier covers dev? |
|---|---|---|
| **Supabase** (supabase.com) | Postgres + Auth + Storage + Realtime | Yes |
| **Resend** (resend.com) | Real email delivery (OTPs + transactional) | Yes (3,000 emails/month) |
| **Cloudflare** (cloudflare.com) | DNS for `salesgeek.scot` so Resend's DKIM/SPF/DMARC work | Yes |
| **GitHub** | Source control | Yes |

The Vercel, GCP, and Upstash accounts only matter in **Phase 10 (Deployment)** — skip them for now.

## 2.3 Supabase — create one project (the dev project)

We only create the **dev project** during the build. The production Supabase project is set up at deployment time (Phase 10), against the same SQL files we've validated in dev.

1. Sign in to **app.supabase.com** → **New project**.
2. Name: `salesgeek-dev`. Database password: generate a strong one and save in 1Password. Region: **`eu-west-2` (London)**.
3. Wait for provisioning (~2 minutes). Then from **Project Settings → API** copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (Reveal → copy) → `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never put this in the frontend.
   - **JWT Secret** → `SUPABASE_JWT_SECRET`
4. From **Project Settings → Database → Connection string → URI**:
   - **Session-mode (port 5432)** → `DATABASE_URL` (for the backend)
   - **Transaction-mode pooler (port 6543)** → `DATABASE_POOL_URL` (for hot read paths)

SQL gets pasted into **Dashboard → SQL Editor** during each phase — see Part 6.

The detailed Supabase Auth configuration (Resend SMTP, 24h session, anonymous sign-in) is in Part 4.

## 2.4 Resend — sign up and start domain verification

Real emails from day one means real DNS records. Start this early because DNS propagation takes time.

1. Sign up at **resend.com**.
2. **Domains → Add domain.** Use `mail.salesgeek.scot` (a subdomain so the apex stays clean).
3. Resend shows three DNS records (SPF, DKIM, DMARC). Add them to Cloudflare (§2.5).
4. Once verified, **API Keys → Create API key**. Scope it to "Sending access only". Save as `RESEND_API_KEY`.
5. Add a **test inbox** like `engineering+sgexpo@litlabs.io` — we'll send development OTPs to this.

Full details in Part 3.

## 2.5 Cloudflare — DNS

In Cloudflare, for `salesgeek.scot`, add only the **three Resend records** for now:

| Record | Type | Value | Purpose |
|---|---|---|---|
| `send.mail` | TXT | (from Resend) | SPF |
| `resend._domainkey.mail` | CNAME | (from Resend) | DKIM |
| `_dmarc.mail` | TXT | (from Resend) | DMARC |

The `app` and `api` CNAMEs only get added in Phase 10 when we have Vercel/GCP targets to point at.

## 2.6 Local environment variables

Create `.env.local` at the repo root. This is the only env file we use during development.

```env
# --- Frontend (browser-safe, prefixed NEXT_PUBLIC_) ---
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard>
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080   # local backend

# --- Backend / server-only ---
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
SUPABASE_JWT_SECRET=<from Supabase dashboard>
DATABASE_URL=postgresql://postgres:<pw>@<project>.supabase.co:5432/postgres
DATABASE_POOL_URL=postgresql://postgres:<pw>@<project>.pooler.supabase.co:6543/postgres
REDIS_URL=redis://localhost:6379                # local Docker Redis

# --- Email ---
RESEND_API_KEY=<from Resend>
EMAIL_FROM="SalesGeek Scotland <noreply@mail.salesgeek.scot>"
DEV_TEST_INBOX=engineering+sgexpo@litlabs.io    # where OTPs go in dev scripts

# --- App secrets (generate with `openssl rand -hex 32`) ---
QR_SIGNING_SECRET=<32 random bytes hex>
CALENDLY_WEBHOOK_SECRET=<32 random bytes hex>
BACKEND_SHARED_SECRET=<32 random bytes hex>     # used between frontend/backend for non-user calls
```

`.env.local` is gitignored. Commit `.env.example` with placeholder values so a fresh clone knows what to fill in.

## 2.7 Bring up the local stack

```bash
git clone <repo-url> sales-geek-expo
cd sales-geek-expo
pnpm install

# Local Redis
docker compose -f infra/docker/docker-compose.yml up -d

# Paste 0000_extensions.sql and 0001_phase0_foundation.sql
# into Supabase Dashboard → SQL Editor (one time, see Phase 0)

# Seed
pnpm db:seed

# Run both apps locally
pnpm dev:backend &
pnpm dev:web &

open http://localhost:3000/sge-2026
```

If frontend loads at `localhost:3000`, backend responds at `localhost:8080/health`, and Supabase auth works against the cloud dev project, you're ready for Phase 0's test gate.

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

## 3.5 Transactional email beyond auth (backend → Resend)

The backend sends a few non-auth emails (in local dev, the same Resend API key sends real emails to the test inbox; in production, to real attendees):

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

- Site URL: `http://localhost:3000` during the local build; updated to `https://app.salesgeek.scot` at Phase 10.
- Redirect allow-list (local build): `http://localhost:3000/**` plus any tunnel URL you use for mobile testing (e.g. a `*.trycloudflare.com` URL).

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

## 4.4 Validating Supabase JWTs in the backend

The backend (local Hono during the build, Cloud Run after Phase 10) receives `Authorization: Bearer <access_token>` on every frontend-proxied request. It validates the JWT using **`SUPABASE_JWT_SECRET`** (from Supabase Dashboard → Settings → API → JWT Secret). On valid, it extracts `sub` (the auth user id), looks up `public.users` by `auth_user_id`, and attaches role + attendee record to the request context.

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
- Admin creates a broadcast → backend creates the `notifications` row → enqueues a fan-out job (local Redis queue during the build; Cloud Tasks after Phase 10) that writes per-attendee `notification_recipients` rows in batches of 500.

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
- Delivery status comes back via Resend's webhook into the backend and is recorded on `notification_recipients`. (Locally, point the Resend webhook at a `cloudflared tunnel` URL for the duration of the test.)

## 5.4 Scheduled broadcasts

- Set `scheduled_at` in the future. The row sits in `notifications` until due.
- During the local build, a simple `setInterval` inside `apps/backend` fires `POST /jobs/notifications-due` every 60 seconds. In Phase 10 we replace it with **Cloud Scheduler** without any code changes — same endpoint, different invoker.

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
- **RLS-on by default.** Every table has Row Level Security enabled with **no default policies** — only the `service_role` (used by the backend) can read/write. Where we need browser-direct reads (leaderboard, agenda, events_public), we add **explicit select policies** for the `anon` and `authenticated` roles in the same file.

## 6.2 How to apply a phase's SQL

1. Open **app.supabase.com** → your dev project → **SQL Editor → New query**.
2. Open the phase's `.sql` file in the repo.
3. Paste, click **Run**. The Editor shows any errors with line numbers.
4. Once dev is green, repeat the paste against the prod project at production cutover (Part 8).

## 6.3 Types in the app

The frontend uses `@supabase/supabase-js` typed via Supabase Dashboard's **"Generate types"** button (Dashboard → API). Copy the output into `packages/contracts/db-types.ts` once per phase. No CLI required.

The backend uses **Drizzle ORM** with hand-written TypeScript schema definitions in `apps/backend/src/db/schema.ts`. Drizzle stays the source of typed-query truth on the backend; the SQL files in `supabase/sql/` stay the source of schema truth in Postgres. We keep them in sync by treating SQL as canonical and updating Drizzle to match each phase.

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
The empty house, running on your laptop. A monorepo that boots, a local Next.js dev server, a local Hono backend, and a dev Supabase project holding the first three tables. No deploys yet.

### SQL to paste
Write `supabase/sql/0000_extensions.sql` (enables `pgcrypto`, `uuid-ossp`, `pg_trgm`, `btree_gin`) and `supabase/sql/0001_phase0_foundation.sql` (creates `events`, `users`, `audit_logs`, with RLS on and an auto-sync trigger from `auth.users → public.users`). Paste both into Supabase Dashboard → SQL Editor → Run, against the **dev** project.

### Files & repo layout
- `apps/web/` — Next.js 14 App Router (runs locally via `pnpm dev:web`)
- `apps/backend/` — Hono server (runs locally via `pnpm dev:backend`)
- `packages/domain/` — pure domain logic, imported by `apps/backend`
- `packages/contracts/` — Zod schemas + generated Supabase types
- `supabase/sql/` — pasted-in SQL migrations (start populating in this phase)
- `infra/docker/docker-compose.yml` — just Redis on port 6379
- `.env.local` — every env var the app/backend needs (gitignored)
- `.env.example` — committed template

### How to build it (step-by-step)

1. **Scaffold the monorepo.** pnpm workspaces + Turborepo. Root `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
2. **Create the Next.js app.** `pnpm create next-app@14 apps/web --typescript --app --tailwind --eslint`. Strip the demo content. Add `@supabase/supabase-js` and `@supabase/ssr`, then create `lib/supabase-browser.ts` (anon-key client for the browser) and `lib/supabase-server.ts` (server-side client that reads the session cookie).
3. **Create the backend.** `apps/backend/` is a small **Hono** server. Routes: `GET /health`, plus a JWT validation middleware that decodes the Supabase access token using `SUPABASE_JWT_SECRET`. Connect to Postgres via **Drizzle ORM** using `DATABASE_URL`.
4. **Local Redis.** Add `infra/docker/docker-compose.yml` with a single `redis:7-alpine` service on `:6379`. Use `ioredis` from the backend.
5. **Paste the SQL.** Open the dev Supabase project's SQL Editor and run `0000_extensions.sql` then `0001_phase0_foundation.sql`. Verify tables exist via **Table Editor**.
6. **Generate types.** In Supabase Dashboard → API → "Generate types" → TypeScript. Save the output to `packages/contracts/db-types.ts`. (No CLI required — the dashboard gives you a copy-pasteable file.)
7. **Wire the Drizzle schema.** In `apps/backend/src/db/schema.ts`, write Drizzle table definitions matching the SQL you pasted. SQL stays canonical; Drizzle stays in sync by hand.
8. **Implement the audit pattern.** `packages/domain/audit.ts` exports `withAudit(tx, actor, action, target, reason, fn)` — wraps a Drizzle transaction, runs `fn`, then inserts an `audit_logs` row in the same transaction. Every later mutation uses this.
9. **RBAC.** `packages/domain/rbac.ts` exports `canDoAction(actor, action, resource)`. A backend middleware `requireRole(...roles)` runs after JWT validation.
10. **Run everything locally.**
    - Terminal 1: `docker compose -f infra/docker/docker-compose.yml up -d` (Redis)
    - Terminal 2: `pnpm dev:backend` (Hono on `:8080`)
    - Terminal 3: `pnpm dev:web` (Next.js on `:3000`)
11. **CI.** `.github/workflows/ci.yml` runs `pnpm typecheck && pnpm lint && pnpm test` on every PR. CI does not deploy anything — it just keeps the repo green.

### Health check end-to-end
- `http://localhost:3000/health` — Next.js responds OK.
- `http://localhost:8080/health` — backend responds OK, including a `db_reachable: true` flag from a `select 1` against the dev Supabase Postgres.
- Frontend `lib/supabase-browser.ts` can `select` from `events_public` (empty array, but no auth error — proves RLS + anon key are configured).

### Scripts to create

1. **[scripts/db-truncate.ts](../scripts/db-truncate.ts)** — connects to dev Supabase via `DATABASE_URL`, truncates every app table (except `auth.*`), resets sequences. **Refuses to run** if `SUPABASE_URL` contains `prd` (safety guard for Phase 10).
2. **[scripts/seed-base.ts](../scripts/seed-base.ts)** — connects to dev Supabase via service-role, inserts one event (`sge-2026`), one admin user, one staff user. Idempotent (`on conflict do nothing`).
3. **[scripts/smoke.ts](../scripts/smoke.ts)** — pings `http://localhost:3000/health` and `http://localhost:8080/health`, asserts 200, exits 0/1.
4. **[scripts/test-audit.ts](../scripts/test-audit.ts)** — calls a `withAudit` write through a backend test endpoint, queries `audit_logs`, asserts one row. Also runs the call but forces an exception inside `fn`, asserts no audit row leaked (transactional integrity).
5. **[scripts/test-rbac.ts](../scripts/test-rbac.ts)** — generates a JWT for a fake staff user, calls an admin-only backend endpoint, asserts 403. Same with an admin JWT — asserts 200.
6. **[scripts/gen-types.sh](../scripts/gen-types.sh)** — convenience: opens the Supabase Dashboard type-generator URL for the dev project. You paste the result into `packages/contracts/db-types.ts`.

`package.json`:
```json
"scripts": {
  "dev:web": "pnpm --filter web dev",
  "dev:backend": "pnpm --filter backend dev",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "redis:up": "docker compose -f infra/docker/docker-compose.yml up -d",
  "redis:down": "docker compose -f infra/docker/docker-compose.yml down",
  "db:truncate": "tsx scripts/db-truncate.ts",
  "db:seed": "tsx scripts/seed-base.ts",
  "smoke": "tsx scripts/smoke.ts",
  "test:audit": "tsx scripts/test-audit.ts",
  "test:rbac": "tsx scripts/test-rbac.ts"
}
```

### How to test it
```bash
# 1. Paste 0000 + 0001 SQL into the dev Supabase project (one time).
# 2. Local stack:
pnpm install
pnpm redis:up
pnpm db:truncate     # safe-noop if empty
pnpm db:seed
pnpm dev:backend &   # backend on :8080, pointed at dev Supabase
pnpm dev:web &       # web on :3000, pointed at dev Supabase + local backend
sleep 5
pnpm smoke
pnpm test:audit
pnpm test:rbac
pnpm test            # vitest unit suite
pnpm typecheck
pnpm lint
```

### Test gate (must all pass to open Phase 1)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] `pnpm smoke` returns 0 (both `localhost:3000/health` and `localhost:8080/health`)
- [ ] `pnpm test:audit` returns 0
- [ ] `pnpm test:rbac` returns 0
- [ ] `0000_extensions.sql` + `0001_phase0_foundation.sql` applied cleanly in dev Supabase; tables visible in Table Editor
- [ ] Frontend can read `events_public` from the browser (RLS-permitted)
- [ ] Backend rejects requests without a valid Supabase JWT

### Non-negotiables
- No mutation function exists outside `withAudit`. Grep `apps/backend/src` for direct `db.insert`/`db.update` outside the `withAudit` wrapper — there should be none in domain code.
- The `audit_logs` table is **append-only**. No domain code calls `update` or `delete` on it (also revoked at the SQL level for non-service-role).
- The `service_role` key never reaches the browser. It only lives in `.env.local` (server-side) on your laptop. When we deploy in Phase 10 it moves to GCP Secret Manager and Vercel's server-side env.

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
- RLS: `attendees` has a `select` policy where `auth_user_id = auth.uid()` so each attendee can read **only their own** row from the browser; writes still go through the backend

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
- Open `http://localhost:3000/sge-2026/join` (or expose it to your phone via `cloudflared tunnel --url http://localhost:3000`).
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

# Part 8 — Deployment (Phase 10)

Phase 10 only opens when Phase 9 is green: `pnpm uat` exits 0 on a clean laptop run with every test gate passing. **Do not provision cloud resources before then.**

The shape is straightforward: we take the same code we have been running locally for two weeks, deploy the frontend to Vercel, deploy the backend to GCP Cloud Run, move Redis from Docker to Upstash, and create a fresh Supabase **prod** project that mirrors the dev one we have been pasting SQL into. Resend stays exactly as-is.

## Phase 10.1 — Create production accounts (T-3 days)

| Service | What to create | Notes |
|---|---|---|
| Supabase | New project `salesgeek-prd` | Same region (`eu-west-2`), Pro plan for daily backups + PITR |
| Vercel | Connect repo, create project `salesgeek` | Hobby is fine for the build; switch to Pro the week of the event for password protection on preview deploys |
| GCP | New project `salesgeek-prd`, enable Cloud Run + Cloud Build + Cloud Scheduler + Cloud Tasks + Secret Manager + Artifact Registry | Link existing credits |
| Upstash | New Redis DB `salesgeek-prd-redis` | Region `eu-west-2`, TLS on, pay-as-you-go tier |
| Resend | (already done) — promote sending domain to "verified" in production usage | No new domain needed |

### Production env-var inventory

Same shape as `.env.local`, with these differences:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<prd-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prd anon>
NEXT_PUBLIC_BACKEND_URL=https://api.salesgeek.scot
SUPABASE_SERVICE_ROLE_KEY=<prd service-role>
SUPABASE_JWT_SECRET=<prd JWT secret>
DATABASE_URL=postgresql://...:5432/postgres        # prd session-mode
DATABASE_POOL_URL=postgresql://...:6543/postgres   # prd pooler
REDIS_URL=<from Upstash>                            # rediss:// (TLS)
UPSTASH_REDIS_REST_URL=<from Upstash>               # for the HTTP client
UPSTASH_REDIS_REST_TOKEN=<from Upstash>
RESEND_API_KEY=<from Resend>
EMAIL_FROM="SalesGeek Scotland <noreply@mail.salesgeek.scot>"
```

Vercel server-side env, GCP Secret Manager (backend), Upstash and Supabase already hold theirs.

## Phase 10.2 — Apply all SQL to the prod Supabase project (T-3 days)

1. Open the prod Supabase project → SQL Editor.
2. Paste **every file in `supabase/sql/` in order**, `0000` through the last one, one at a time. Run each, confirm no errors.
3. Configure prod Auth identically to dev (Part 4):
   - Email OTP on
   - Anonymous sign-ins on
   - JWT expiry 3600, refresh token TTL 86400, rotation on
   - SMTP set to Resend (same API key, same `noreply@mail.salesgeek.scot` sender)
   - Site URL: `https://app.salesgeek.scot`
   - Redirect allow-list: `https://app.salesgeek.scot/**`, plus Vercel preview domain pattern
4. Open prod Table Editor; confirm structure matches dev.
5. Generate prod-side types — paste into `packages/contracts/db-types.prd.ts` for spot-check. Should be identical to dev's types.

## Phase 10.3 — Deploy the backend to GCP Cloud Run (T-2 days)

```bash
# Install gcloud CLI
brew install --cask google-cloud-sdk
gcloud auth login
gcloud config set project salesgeek-prd

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com

# Create Artifact Registry
gcloud artifacts repositories create salesgeek --repository-format=docker --location=europe-west2

# Push every secret to Secret Manager
for VAR in SUPABASE_SERVICE_ROLE_KEY SUPABASE_JWT_SECRET DATABASE_URL DATABASE_POOL_URL \
           REDIS_URL UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN \
           RESEND_API_KEY QR_SIGNING_SECRET CALENDLY_WEBHOOK_SECRET BACKEND_SHARED_SECRET; do
  echo -n "<value>" | gcloud secrets create $VAR --data-file=- --replication-policy=automatic
done

# Build and push the backend image
gcloud builds submit --tag europe-west2-docker.pkg.dev/salesgeek-prd/salesgeek/backend:v1 ./apps/backend

# Deploy Cloud Run service
gcloud run deploy backend \
  --image europe-west2-docker.pkg.dev/salesgeek-prd/salesgeek/backend:v1 \
  --region europe-west2 \
  --service-account=backend-runtime@salesgeek-prd.iam.gserviceaccount.com \
  --min-instances=2 --max-instances=20 \
  --cpu=1 --memory=1Gi --concurrency=80 \
  --update-secrets=SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,\
SUPABASE_JWT_SECRET=SUPABASE_JWT_SECRET:latest,\
DATABASE_URL=DATABASE_URL:latest,\
DATABASE_POOL_URL=DATABASE_POOL_URL:latest,\
REDIS_URL=REDIS_URL:latest,\
RESEND_API_KEY=RESEND_API_KEY:latest,\
QR_SIGNING_SECRET=QR_SIGNING_SECRET:latest,\
CALENDLY_WEBHOOK_SECRET=CALENDLY_WEBHOOK_SECRET:latest,\
BACKEND_SHARED_SECRET=BACKEND_SHARED_SECRET:latest \
  --no-allow-unauthenticated
```

Note the service URL (something like `https://backend-xxxx-ew.a.run.app`). Smoke it: `curl https://backend-xxxx-ew.a.run.app/health` (expect 401 — that's correct, it rejects unauthenticated; bypass with a signed test token).

### Cron jobs

```bash
# Notifications due-poll — every minute
gcloud scheduler jobs create http notifications-due \
  --schedule="* * * * *" --http-method=POST \
  --uri=https://backend-xxxx-ew.a.run.app/jobs/notifications-due \
  --oidc-service-account-email=scheduler@salesgeek-prd.iam.gserviceaccount.com

# William reconciler — every 5 minutes
gcloud scheduler jobs create http william-reconcile \
  --schedule="*/5 * * * *" --http-method=POST \
  --uri=https://backend-xxxx-ew.a.run.app/jobs/william-reconcile \
  --oidc-service-account-email=scheduler@salesgeek-prd.iam.gserviceaccount.com

# Archive transition + reward expiry — daily at 03:00 UTC
gcloud scheduler jobs create http daily-maintenance \
  --schedule="0 3 * * *" --http-method=POST \
  --uri=https://backend-xxxx-ew.a.run.app/jobs/daily-maintenance \
  --oidc-service-account-email=scheduler@salesgeek-prd.iam.gserviceaccount.com
```

### Cloud Tasks queues

```bash
gcloud tasks queues create notifications-fanout --location=europe-west2 --max-dispatches-per-second=50
gcloud tasks queues create email-retry --location=europe-west2 --max-dispatches-per-second=5
gcloud tasks queues create exports-heavy --location=europe-west2 --max-dispatches-per-second=2
```

## Phase 10.4 — Deploy the frontend to Vercel (T-2 days)

1. Connect the GitHub repo on Vercel. Set root directory to `apps/web`. Framework preset: Next.js.
2. Set environment variables in **Vercel → Settings → Environment Variables**, **for Production scope only** first:
   - All `NEXT_PUBLIC_*` plus the server-side secrets the Next.js layer needs (`SUPABASE_SERVICE_ROLE_KEY`, `BACKEND_SHARED_SECRET`).
   - **Do NOT** set `DATABASE_URL` here — Vercel never talks to Postgres directly. All DB writes go via the backend.
3. Trigger a production build from `main`. Confirm it succeeds.
4. Bind the custom domain `app.salesgeek.scot`. Vercel will give you a CNAME — add it in Cloudflare (DNS-only, **not** proxied — Vercel manages its own TLS).
5. Smoke: `curl https://app.salesgeek.scot/health` → 200.

### Cloudflare for the backend

Add a Cloudflare DNS record:

| Record | Type | Value | Proxied? |
|---|---|---|---|
| `api` | CNAME | `<cloud-run-url>.a.run.app` | **Yes (proxied)** — enables Cloud Armor-style rules + DDoS at the edge |

In Cloud Run, bind the custom domain `api.salesgeek.scot` via **Cloud Run → Domain Mappings**. Wait for the cert to issue.

## Phase 10.5 — Post-deploy smoke and seed (T-1 day)

```bash
# From your laptop, with prod env vars in a local file:
export $(cat .env.production)
pnpm smoke --target=prod
pnpm test:e2e --env=prod   # full Playwright suite against prod
```

Seed real production data via the admin UI on `https://app.salesgeek.scot/admin`:

- Real event row (`sge-2026`, dates, brand tokens)
- Real admin and staff users
- Real businesses + their auto-generated QRs
- Real reward catalog
- Real agenda, geeks, sponsors

Done via UI rather than a seed script — production seeds being one-off makes a script unnecessary risk.

## Phase 10.6 — Pre-event freeze and the event-day runbook (T-48h to T+0)

48 hours before doors open:

- Code freeze. No merges to `main` except for incident fixes.
- Take a manual Supabase backup snapshot.
- Restore-drill the snapshot into a scratch project.
- Re-verify Resend deliverability to fresh `@gmail`, `@outlook`, `@icloud` inboxes.
- Tighten Cloud Armor rate limits on `/scan/*` and `/auth/otp` paths.
- Bump Cloud Run `min-instances` to 4 (web equivalent if applicable) for the warm pool.
- Confirm on-call rota in `Docs/event-day-runbook.md` (separate document — to be written when Phase 9 closes).

T-2 hours on event day:

- Final smoke suite.
- Dashboard up on the ops table.
- Slack/PagerDuty alerts confirmed.

During the event:

- On-call watches dashboards.
- Any change requires explicit approval from the technical lead.
- **Feature flag flips are the preferred remediation, not redeploys.**

## Phase 10.7 — Disaster recovery sketch

| Scenario | Mitigation | RTO | RPO |
|---|---|---|---|
| Cloud Run region outage | Manual redeploy to `europe-west1` using the same image | 30 min | 0 (DB unaffected) |
| Supabase outage | Wait + status page; no failover plan v1 (acceptable for one-day event) | per Supabase | per Supabase |
| Resend outage | Switch SMTP back to Supabase's built-in (degraded delivery, but OTPs still flow) | 10 min | n/a |
| Upstash outage | App falls back to DB-level idempotency (slower but correct) | n/a | n/a |
| Vercel outage | Static fallback page on Cloudflare for the public-facing slug | 15 min | n/a |
| Total data corruption | Point-in-time restore from Supabase PITR | 30 min | 5 min |

## Phase 10.8 — Production readiness checklist

**Infrastructure**
- [ ] Supabase prd project provisioned, Pro plan, PITR on
- [ ] All SQL files applied to prd, Table Editor matches dev
- [ ] Vercel project live, custom domain bound, TLS green
- [ ] GCP Cloud Run service deployed, custom domain bound, TLS green
- [ ] Upstash Redis live, TLS, connection tested from Cloud Run
- [ ] Resend domain verified, SPF/DKIM/DMARC all green in `mxtoolbox`
- [ ] Cloud Scheduler jobs configured
- [ ] Cloud Tasks queues configured

**Security**
- [ ] All secrets in GCP Secret Manager + Vercel Env, none in repo
- [ ] Service-role key absent from any frontend env var (`NEXT_PUBLIC_*`)
- [ ] HMAC validation on `/scan/*` and Calendly webhook
- [ ] RLS enabled on every table, deny-all by default
- [ ] CORS on backend limited to `app.salesgeek.scot` and Vercel preview pattern

**Platform**
- [ ] Phase 0–9 gates green on `main`
- [ ] `pnpm smoke --target=prod` returns 0
- [ ] Full Playwright suite green against prod
- [ ] Real-event seed data entered via admin UI

**Operations**
- [ ] On-call rota published
- [ ] Event-day runbook exists
- [ ] Alert routing tested end-to-end
- [ ] Pre-event freeze active
- [ ] Backup taken at T-24h

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
| 1 | Tue 12 May | Phase 0 | Local frontend + backend + dev Supabase all respond on `/health`; SQL `0000` + `0001` applied |
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
- **RLS (Row Level Security).** Postgres feature that enforces per-row access at the database level. We enable it on every table; the backend uses the service-role key (bypasses RLS), the browser uses the anon/authenticated keys (subject to RLS).
- **Anonymous sign-in.** Supabase Auth feature that gives an unverified user a `auth.users` row + JWT immediately. Lets us keep the desk line moving and upgrade to verified on OTP.
- **Realtime.** Supabase service that streams Postgres row changes to subscribed browsers via WebSocket. We use it to push notifications and score updates without polling.
- **Resend.** Transactional email provider. Powers both Supabase Auth OTP emails (via SMTP) and our app's non-auth emails (via API).
- **Service-role key.** Supabase's "god mode" key that bypasses RLS. During the build it lives only in your laptop's `.env.local` (server-side). After Phase 10 it moves to GCP Secret Manager and Vercel server-side env. Never goes anywhere near the browser.
- **k6.** Load testing tool. We run it against the dev cloud stack in Phase 9.
- **Playwright.** Browser automation. We script real user flows against `localhost:3000` during the build; against `app.salesgeek.scot` after Phase 10.
- **Test gate.** The list of test cases that must pass for the phase to count as "done". No exceptions.

---

*End of phased implementation plan.*
