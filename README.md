# Scottish Growth Expo — Event Companion Platform

A mobile-first, multi-event web platform built by **SalesGeek Scotland**, first run live at **Scottish Growth Expo 2026** (Hampden National Stadium, Glasgow · 500 attendees).

One URL operates in three modes — **pre-event → event-day → post-event archive** — and drives the attendee app, the venue TV portals, and the admin/staff back office.

---

## What it does

- **Attendee app** (mobile web): live agenda, speaker ("Geeks") profiles with booking links, sponsor directory, a static prize gallery, an anonymous live leaderboard, and a QR-driven points game. Attendees scan sponsor QR codes for points and scan each other to make connections.
- **Venue TV portals** (`/tv/*`): full-screen, auto-refreshing big-screen views — points leaderboard, connections board, timed-block winners, live stats, sponsor ticker, and looping promo video.
- **Admin / staff back office**: QR campaign creation, business/sponsor management, live ops dashboard, CSV exports, announcements, and notifications.

---

## Architecture

```
Attendee phone ──▶ Vercel (Next.js web)
                      │  server actions + /api routes proxy to ▼
                      ▼
                   GCP VM (Docker Compose)
                     ├─ backend  (Hono :8081)   ── business logic, scoring, scan engine
                     ├─ worker   (Hono :8082)   ── notification fan-out, archive transition
                     ├─ redis                    ── scan idempotency + hot caches
                     └─ caddy                    ── HTTPS reverse proxy
                      │
                      ▼
                   Supabase  (Postgres + Auth)
```

### Monorepo layout

```
apps/
  web/        Next.js 14 app — attendee app, TV portals, admin/staff, /api proxy routes
  backend/    Hono API — scan/scoring engine, leaderboard, content, admin ops
  worker/     Hono job runner — notification fan-out (60s poll), archive transition
packages/
  contracts/  generated Supabase DB types
  domain/     pure business logic — qr signing, scoring, leaderboard, rbac, exports, …
supabase/sql/ ordered SQL migrations (0000 → 0015)
scripts/      operational tooling — event seeding, attendee import, QR sheet generation
infra/        Docker Compose, Caddyfile, deploy script
```

### Stack

- **Web**: Next.js 14 (App Router), React, Supabase SSR auth, `html5-qrcode` (code-split)
- **Backend / worker**: Hono on Node 20, `postgres` (tagged-template SQL — no ORM), `ioredis`
- **Data**: Supabase Postgres with Row-Level Security; transaction-mode connection pooling (`:6543`)
- **Deploy**: Vercel (web) + GCP Compute Engine Docker Compose (backend/worker/redis/caddy)

---

## How the core mechanics work

- **Auth** — passwordless. Attendees enter their email and are signed in via a Supabase magic-link token verified in the browser (`/auth/verify`); email-scanner bots can't consume the token because verification runs in JS. Email is the canonical, immutable identity.
- **QR scanning** — every QR encodes a signed URL `/<event>/scan/<code>?sig=<hmac>`. Signatures are `HMAC-SHA256(secret, "<eventId>:<code>:<type>")`, so codes can't be forged. Awards are idempotent (one per attendee per QR) via a unique constraint + a Redis in-flight guard.
- **Two ledgers** — a competition score (drives the leaderboard) and a spendable balance, tracked separately per attendee.
- **Leaderboard** — anonymous (aliases only), top 10 + your own rank, tie-broken by who reached the score first. Three fixed 2-hour "blocks" snapshot a winner when each block ends.
- **Connections** — attendees scan each other's profile QR to connect; 1 point each per new connection.

---

## Local development

```bash
pnpm install
cp .env.example .env.local      # fill in Supabase + backend URLs (see infra/docker/*.example)

pnpm --filter web dev           # Next.js on :3000
pnpm --filter backend dev       # Hono API on :8081
pnpm --filter worker dev        # job runner on :8082
```

Apply database migrations by running the files in `supabase/sql/` in order against your Supabase project (SQL editor or `scripts/apply-sql.ts`).

See [`Docs/local-testing-guide.md`](Docs/local-testing-guide.md) for the full local walkthrough.

---

## Deployment

- **Web** → Vercel (push to deploy). Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`.
- **Backend + worker + redis + caddy** → GCP VM via `infra/docker/docker-compose.prod.yml`.

Full runbook: [`Docs/deployment.md`](Docs/deployment.md) and [`Docs/deployment-steps.md`](Docs/deployment-steps.md).

---

## Performance notes

The platform is tuned to work on congested venue mobile data, not just WiFi:

- Middleware skips the auth round-trip on public paths (TV/API/health) and caches event metadata, so it doesn't re-hit Supabase on every navigation.
- The attendee shell renders from a local session-cookie read alone; ensuring the attendee record and any first-time redirect happen in a bounded, fire-once client effect *after* first paint — a slow backend never blocks the UI.
- The QR scanner library is code-split and loaded only when the scanner opens.
- Postgres runs through transaction-mode pooling to absorb sign-in bursts.

---

*Built and operated by SalesGeek Scotland. Reference docs: [`northstar.md`](northstar.md) (scope), [`deliverables.md`](deliverables.md) (feature summary), [`CLAUDE.md`](CLAUDE.md) (engineering context).*
