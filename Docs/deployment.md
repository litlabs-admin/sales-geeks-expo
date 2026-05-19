# Deployment Guide — SalesGeek Scotland Expo App

**Target event:** Scottish Growth Expo 2026 · 26 May 2026 · Hampden National Stadium, Glasgow
**This guide gets you from a clean repo to a live production system.**

Every step below has the exact command **and** an explanation of *what it does* and *why it exists*. Read the "Why" boxes — they are the difference between copy-pasting and understanding what you are running on event day.

> **First time deploying? Use [deployment-steps.md](deployment-steps.md) instead.** That guide is a beginner-safe checklist that uses the simplest path: push to GitHub → `git clone` on the VM → build the images **on the VM** (`docker compose build`) — no Docker on your laptop and no Artifact Registry needed. *This* document is the in-depth reference and also covers the alternative "build on laptop, push to Artifact Registry" workflow (Parts 4–5). The `docker-compose.prod.yml` supports **both**: it has a `build:` section (used on the VM) and an `image:` name (used by the registry flow). Pick one path; don't mix.

---

## 0. The Big Picture — What We Are Building and Why

This app is a **3-service monorepo** plus two stateful dependencies:

| Service | Tech | Port | Where it runs | Why there |
|---------|------|------|---------------|-----------|
| `apps/web` | Next.js 14 | 3000 | **Vercel** | Next.js is built by the company that makes Vercel. Zero-config deploys, global CDN at the edge (fast for 500 phones on venue wifi), automatic HTTPS, instant rollback. We get all of this for free instead of hand-managing Nginx + a Node process + certs. |
| `apps/backend` | Hono | 8081 | **GCP VM (Docker)** | A long-lived stateful API that holds Redis connections, a Postgres pool, signs QR codes, and serves admin/staff. It must be a persistent process we fully control — not a serverless function that cold-starts and drops connections. |
| `apps/worker` | Hono | 8082 | **GCP VM (Docker)** | Runs a `setInterval` 60-second poll loop that fans out due notifications. A poll loop *cannot* run on serverless (it would be killed between requests). It needs an always-on container. |
| Redis | redis:7 | 6379 | **GCP VM (Docker)** | Used for scan idempotency + rate limiting. Co-locating it on the same VM as backend/worker means **zero network latency** and **no external Redis bill**. It is never exposed to the internet. |
| Postgres + Auth | Supabase | — | **Supabase Cloud** | Already the system of record. Managed Postgres + magic-link auth. We do not self-host this. |
| Email | Resend | — | **Resend Cloud** | Already wired in for magic links + notification fanout. |

### Why this split (Vercel + a single GCP VM) instead of all-Cloud-Run or all-Vercel

- **Not all Vercel:** Vercel runs serverless functions. Our backend holds a Postgres pool and Redis connections and the worker runs a 60s timer — both are fundamentally incompatible with the serverless model (no persistent process, no background timers).
- **Not Cloud Run:** We need a 60s poll loop and a co-located Redis with zero latency. Cloud Run scales to zero and bills per-request; a always-on container + sidecar Redis is awkward and more expensive than one small VM. The client also explicitly ruled out Cloud Run.
- **One VM with Docker Compose** gives us: full control, all three stateful pieces (backend, worker, Redis) on one private Docker network, one `docker compose up` to deploy, and trivial rollback. For a single-day 500-attendee event this is the simplest thing that is robust.

### The request path on event day

```
Attendee's phone
   │  https://tarsha-expo.vercel.app          (Vercel Edge, EU region — Next.js)
   ▼
Vercel (Next.js)
   │  some pages call the API server-side, the browser calls it directly too
   │  → https://api.34-30-155-166.sslip.io    (NEXT_PUBLIC_BACKEND_URL)
   ▼
GCP VM  34.30.155.166  (europe-west2 / London)
   ├─ Caddy        :80/:443   ← the ONLY thing exposed to the internet
   │     └─ reverse_proxy → backend:8081
   ├─ backend      :8081      (private Docker network)
   ├─ worker       :8082      (private Docker network, no public port)
   └─ redis        :6379      (private Docker network, never public)
        │
        ▼
   Supabase Cloud (eu-west-2) — Postgres + Auth
   Resend Cloud — transactional email
```

**Key security fact:** Caddy is the *only* container with public ports. The GCP firewall only opens 80/443. `backend:8081`, `worker:8082`, and `redis:6379` are reachable *only* on the internal Docker bridge network — even though Docker binds 8081 on the VM, the cloud firewall makes it unreachable from outside.

> ### ⚠️ No domain yet — how this deployment still works
>
> You don't own a domain, so this guide uses **`sslip.io`**, a free public wildcard-DNS service. The hostname **`api.34-30-155-166.sslip.io`** automatically resolves to your VM's IP `34.30.155.166` — **no DNS records to create, no Cloudflare, nothing to buy.** Caddy still gets a *real, browser-trusted* Let's Encrypt certificate for it, so HTTPS works end-to-end.
>
> Why not just `api.example.com` or the raw IP? A made-up domain can't get a TLS cert (Let's Encrypt must verify a real, resolvable host), and a raw `http://IP` API is blocked by browsers as **mixed content** when called from the HTTPS Vercel site — the app would not work. `sslip.io` is the only "dummy domain" that actually produces a working HTTPS deployment with zero setup.
>
> The **frontend needs no domain at all** — Vercel issues a free HTTPS URL like `https://tarsha-expo.vercel.app` automatically.
>
> **When you get a real domain later:** change the hostname in the Caddyfile, set the Vercel env vars + `CORS_ALLOWED_ORIGINS` to the new domain, add one DNS `A` record (`api` → `34.30.155.166`), and redeploy. Nothing else changes.

---

## Part 1 — Prerequisites (do this once, on your laptop)

| Tool | Why you need it | Check |
|------|-----------------|-------|
| `gcloud` CLI | Authenticate + push Docker images to GCP Artifact Registry, manage the VM/firewall | `gcloud --version` |
| `docker` | Build the backend & worker images | `docker --version` |
| `pnpm` 9.15.9 | Run migrations/seed scripts locally against Supabase | `pnpm --version` |
| `openssl` | Generate the signing secrets | `openssl version` |
| An account on **Vercel**, **Supabase**, **Resend**, and a **GCP project** | The four platforms | — |
| ~~A domain name~~ | **Not needed** — we use `sslip.io` for the API and the free `*.vercel.app` URL for the frontend (see the no-domain box in section 0) | — |

You also need **SSH access to the VM** (`34.30.155.166`). From the GCP console: Compute Engine → VM → SSH, or `gcloud compute ssh <vm-name> --zone <zone>`.

> **Concrete values already filled in throughout this doc** (no placeholders to swap unless noted):
> - GCP project ID: **`tarsha-ai-491715`**
> - API hostname: **`api.34-30-155-166.sslip.io`** (sslip.io → resolves to the VM, no DNS setup)
> - Frontend URL: **`tarsha-expo.vercel.app`** — change this to whatever Vercel actually assigns your project (Part 8.3), then update CORS + Supabase + Vercel envs to match
> - VM external IP: **`34.30.155.166`** (internal `10.128.0.2`)
> - GCP region: **`europe-west2`** (London — closest to the venue)
> - Still to fill from their dashboards: `YOUR_PROJECT` (Supabase ref), `<your-vm-name>` / `<your-zone>`, the Supabase keys, the Resend API key, and the two secrets from Part 2

---

## Part 2 — Generate the Signing Secrets (do this FIRST, never lose them)

```bash
openssl rand -hex 32   # → this is QR_SIGNING_SECRET
openssl rand -hex 32   # → this is CALENDLY_WEBHOOK_SECRET
```

**Why these matter so much:**

- `QR_SIGNING_SECRET` signs every QR code the system issues. If you ever redeploy the backend with a *different* value, **every QR code already printed/handed out becomes invalid** — scans will fail with a bad-signature error. There is no recovery on event day. Generate it once, store it in your password manager, and reuse the exact same value for every backend redeploy forever.
- `CALENDLY_WEBHOOK_SECRET` authenticates Calendly's webhook callbacks for William's premium reward booking. It must match what you configure in Calendly's webhook settings.

Paste both into a scratch note now. You will put them in `.env.backend` in Part 6.

---

## Part 3 — Understand the Docker Images (the "why" behind the Dockerfiles)

The Dockerfiles already exist at [apps/backend/Dockerfile](apps/backend/Dockerfile) and [apps/worker/Dockerfile](apps/worker/Dockerfile). You do not need to edit them, but understand *why they are shaped this way* because it explains every build command later.

```dockerfile
# Stage 1: deps — install the whole pnpm workspace
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/worker/package.json ./apps/worker/
COPY packages/domain/package.json ./packages/domain/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile

# Stage 2: runner — copy source + node_modules, run TypeScript directly
FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages ./packages
COPY apps/backend/src ./apps/backend/src
EXPOSE 8081
ENV NODE_ENV=production
CMD ["node", "--import", "tsx/esm", "apps/backend/src/server.ts"]
```

**Why it is built this way:**

1. **Multi-stage build.** Stage 1 does the heavy `pnpm install`. Stage 2 only copies what it needs. This keeps the final image smaller and means a code-only change doesn't reinstall dependencies (faster rebuilds).
2. **Manifests copied before source.** Docker caches layers. By copying `package.json`/lockfile *before* the source, the expensive `pnpm install` layer is reused whenever only source code changes — builds drop from minutes to seconds.
3. **`node --import tsx/esm` instead of `tsc` + `node dist/`.** This is the critical, non-obvious one. The `@sgexpo/domain` workspace package exports **TypeScript source files directly** (e.g. `"default": "./src/audit.ts"` in its `package.json`). A normal `tsc` build + `node dist/server.js` would fail to resolve those `.ts` workspace imports at runtime. `tsx` is a Node loader that compiles TS on the fly and resolves pnpm workspace packages natively — so we run the source directly. No build step, no `dist/`.
4. **Built from the repo root, not from `apps/backend/`.** The image needs `packages/` (the workspace packages). The Docker build context must be the monorepo root so `COPY packages ./packages` works. Every build command below uses `-f apps/backend/Dockerfile .` — the trailing `.` is the repo root as context.
5. **`.dockerignore`** ([/.dockerignore](.dockerignore)) excludes `apps/web` (that goes to Vercel, not Docker), all `.env*` files (secrets never get baked into an image), `node_modules`, `.next`, and docs. This keeps the build context small and prevents leaking secrets into image layers.

The worker Dockerfile is identical except it copies `apps/worker` and runs on port 8082.

---

## Part 4 — Set Up GCP Artifact Registry (where the images live)

Artifact Registry is GCP's private Docker registry. The VM pulls images from here; you push to it from your laptop.

```bash
# 1. Point gcloud at your project
gcloud config set project tarsha-ai-491715

# 2. Enable the Artifact Registry API (one-time per project)
gcloud services enable artifactregistry.googleapis.com

# 3. Create a Docker repository called "apps" in the London region
gcloud artifacts repositories create apps \
  --repository-format=docker \
  --location=europe-west2 \
  --description="SalesGeek Expo backend + worker images"

# 4. Let your local Docker authenticate to this registry
gcloud auth configure-docker europe-west2-docker.pkg.dev
```

**Why Artifact Registry and not Docker Hub:** images are private (they don't contain secrets, but the codebase is proprietary), pulls from the VM are fast because the registry is in the same GCP region (`europe-west2`), and the VM authenticates with its built-in GCP service account — no Docker Hub credentials to manage.

Your image registry path is now:
```
europe-west2-docker.pkg.dev/tarsha-ai-491715/apps
```
Remember this string — it is the `REGISTRY` value used everywhere below.

---

## Part 5 — Build and Push the Backend & Worker Images

Run these **from the repo root on your laptop**. There is a helper script at [infra/deploy.sh](infra/deploy.sh), but the manual commands are shown so you understand each step.

```bash
# Set these once per shell session
export REGISTRY="europe-west2-docker.pkg.dev/tarsha-ai-491715/apps"
export TAG="prod"          # use "staging" for the staging round

# Build the backend image (context = repo root, hence the trailing ".")
docker build -f apps/backend/Dockerfile -t "$REGISTRY/backend:$TAG" .

# Build the worker image
docker build -f apps/worker/Dockerfile  -t "$REGISTRY/worker:$TAG"  .

# Push both to Artifact Registry
docker push "$REGISTRY/backend:$TAG"
docker push "$REGISTRY/worker:$TAG"
```

**Why we tag with `prod` / `staging` (not just `latest`):** the tag is your rollback handle. If `prod` breaks on event day, you re-tag the previous known-good image and `docker compose up -d` again. `latest` is ambiguous — you can't tell which build is running. (For real production discipline you can also tag with a git SHA: `-t "$REGISTRY/backend:$(git rev-parse --short HEAD)"`.)

**Or just run the helper script** (it does both builds + both pushes):
```bash
# Edit infra/deploy.sh first: replace tarsha-ai-491715
chmod +x infra/deploy.sh
./infra/deploy.sh prod
```

**Apple-silicon / ARM laptop note:** the VM is x86_64. If you build on an M-series Mac, force the platform or the VM will fail to run the image:
```bash
docker build --platform linux/amd64 -f apps/backend/Dockerfile -t "$REGISTRY/backend:$TAG" .
```

Verify the push:
```bash
gcloud artifacts docker images list europe-west2-docker.pkg.dev/tarsha-ai-491715/apps
```

---

## Part 6 — Prepare the GCP VM

You already have the VM (`34.30.155.166`). These steps install Docker and lay out the deployment directory.

### 6.1 Open the firewall (ports 80 and 443 only)

```bash
gcloud compute firewall-rules create allow-http-https \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server,https-server
```

Then make sure the VM has those network tags (GCP console → VM → Edit → Network tags: add `http-server`, `https-server`, save).

**Why only 80/443:** Caddy listens on 80 (for the Let's Encrypt HTTP challenge + redirect) and 443 (HTTPS). `backend:8081`, `worker:8082`, `redis:6379` must **never** be reachable from the internet — they live on the private Docker network and are only reached by Caddy and each other. This firewall rule is the second security layer behind Docker's network isolation.

### 6.2 SSH into the VM and install Docker

```bash
gcloud compute ssh <your-vm-name> --zone <your-zone>
# ...now you are on the VM...

# Install Docker Engine + the compose plugin
curl -fsSL https://get.docker.com | sudo sh

# Run docker without sudo (log out/in after this)
sudo usermod -aG docker $USER

# Verify (after re-login)
docker --version
docker compose version
```

### 6.3 Let the VM pull from Artifact Registry

```bash
# On the VM
gcloud auth configure-docker europe-west2-docker.pkg.dev
```

This works because the VM runs as a GCP service account that has read access to Artifact Registry in the same project. No keys to copy.

### 6.4 Create the deployment directory — **mirror the repo's `infra/` layout**

This layout is **not arbitrary**. The compose file mounts the Caddyfile via the relative path `../../infra/caddy/Caddyfile`, and Docker resolves bind-mount relative paths *relative to the directory the compose file lives in*. So the structure on the VM must mirror the repo exactly, and you must run `docker compose` from `infra/docker/`:

```bash
# On the VM
sudo mkdir -p /opt/sgexpo/infra/docker
sudo mkdir -p /opt/sgexpo/infra/caddy
sudo chown -R $USER:$USER /opt/sgexpo
```

Final VM layout:
```
/opt/sgexpo/
└── infra/
    ├── docker/
    │   ├── docker-compose.prod.yml
    │   ├── .env.backend          ← real secrets, created here, NEVER committed
    │   └── .env.worker
    └── caddy/
        └── Caddyfile
```

### 6.5 Copy the config files from your laptop to the VM

From your **laptop**, repo root:

```bash
# The compose file
gcloud compute scp infra/docker/docker-compose.prod.yml \
  <your-vm-name>:/opt/sgexpo/infra/docker/ --zone <your-zone>

# The Caddyfile
gcloud compute scp infra/caddy/Caddyfile \
  <your-vm-name>:/opt/sgexpo/infra/caddy/ --zone <your-zone>
```

### 6.6 Verify the Caddyfile on the VM

The Caddyfile in this repo is already set to the sslip.io hostname — no edit needed. Just confirm it:

```bash
# On the VM
cat /opt/sgexpo/infra/caddy/Caddyfile
```

It should read exactly:

```caddy
api.34-30-155-166.sslip.io {
    reverse_proxy backend:8081
    header {
        -Server
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
    log {
        output stdout
        format json
    }
}
```

**Why Caddy and not Nginx:** Caddy obtains and renews a **free Let's Encrypt TLS certificate automatically** the first time it sees a request for `api.34-30-155-166.sslip.io` — zero manual cert commands, zero renewal cron jobs. It also adds the security headers and proxies to the backend over the internal Docker network. `reverse_proxy backend:8081` works because Caddy and backend share the `web` Docker network and Docker's internal DNS resolves the service name `backend`.

### 6.7 Create the real env files on the VM

```bash
# On the VM
nano /opt/sgexpo/infra/docker/.env.backend
```

Paste and fill in (templates: [infra/docker/.env.backend.example](infra/docker/.env.backend.example)):

```bash
NODE_ENV=production

# Supabase — production project (Part 7 gives you these values)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
SUPABASE_JWT_SECRET=YOUR_SUPABASE_JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Redis — Docker internal DNS name, do NOT change
REDIS_URL=redis://redis:6379

# CORS — must include your Vercel prod domain (Part 8). Comma-separated, no spaces.
CORS_ALLOWED_ORIGINS=https://tarsha-expo.vercel.app

# The secrets you generated in Part 2 — reuse forever, never regenerate
QR_SIGNING_SECRET=PASTE_THE_HEX_FROM_PART_2
CALENDLY_WEBHOOK_SECRET=PASTE_THE_OTHER_HEX_FROM_PART_2

# Resend
RESEND_API_KEY=re_YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=onboarding@resend.dev
```

> **No-domain note:** `onboarding@resend.dev` is Resend's shared test sender. Until you verify a real sending domain in Resend, it only delivers to the email address that owns the Resend account — fine for the smoke test (use that email as your test attendee), not fine for the real event. Swap to `noreply@<your-domain>` once you have a domain + verified Resend DNS.

```bash
nano /opt/sgexpo/infra/docker/.env.worker
```

```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
REDIS_URL=redis://redis:6379
RESEND_API_KEY=re_YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Why env files on the VM and not baked into the image:** secrets must never be in a Docker image (anyone who pulls the image could read them from the layer history). `docker-compose.prod.yml` references `env_file: .env.backend` so Compose injects them at container start. The `.dockerignore` also blocks `.env*` from ever entering a build context.

**Why `REDIS_URL=redis://redis:6379`:** `redis` is the Docker Compose service name. On the internal bridge network, Docker's DNS resolves `redis` to the Redis container's IP. There is no host, no port mapping, no password — it is unreachable from outside the VM by design.

---

## Part 7 — Supabase Production Project

### 7.1 Create the project

In the Supabase dashboard: **New project** → name `salesgeek-prod` → region **West EU (London) / eu-west-2** (same region as the VM and the venue → lowest latency) → set a strong DB password.

### 7.2 Collect the connection values

From the Supabase project settings, copy into `.env.backend` / `.env.worker` (Part 6.7):

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://abcd.supabase.co`)
- **Connection string** (use the **pooler / transaction** connection string, port 5432) → `DATABASE_URL`
- **JWT Secret** (Settings → API → JWT Settings) → `SUPABASE_JWT_SECRET`
- **service_role key** (Settings → API) → `SUPABASE_SERVICE_ROLE_KEY`
- **anon/public key** (Settings → API) → you'll need this for Vercel (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Part 8

**Why the pooler connection string:** the backend opens a Postgres connection pool. Supabase's transaction pooler (PgBouncer) handles many short-lived connections efficiently — important when 500 attendees hit the API at once. The direct connection has a low connection cap and will exhaust under load.

### 7.3 Run the database migrations (in order)

The schema lives in [supabase/sql/](supabase/sql/) as 11 ordered files: `0000_extensions.sql` → `0010_production_readiness.sql`.

**Easiest method — Supabase SQL Editor:** open each file in order, paste its full contents into the SQL Editor, run, confirm success, move to the next. Order matters — later files depend on earlier tables.

```
0000_extensions.sql            (pgcrypto, etc.)
0001_phase0_foundation.sql
0002_phase1_multi_event.sql
0003_phase2_identity.sql
0004_phase3_content.sql
0005_phase4_business_qr.sql
0006_phase5_scoring_leaderboard.sql
0007_phase6_rewards.sql
0008_phase7_notifications_ops.sql
0009_phase8_exports_archive.sql
0010_production_readiness.sql
```

**Do NOT run the seed scripts against production.** Seeds are for staging/testing only. Production data is the real event configuration + the real attendee CSV imported when the client provides it.

### 7.4 Configure Supabase Auth redirect URLs

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://tarsha-expo.vercel.app`
- **Redirect URLs (add all of these):**
  - `https://tarsha-expo.vercel.app/**`
  - `https://*-yourteam.vercel.app/**` (Vercel preview deployments, if you use them)

**Why the `/**` wildcard:** magic-link auth redirects the user back to the exact page they were on (e.g. `/sge-2026/home`). Without the wildcard, Supabase rejects the redirect and login silently fails. Forgetting this is the #1 cause of "the magic link doesn't log me in" on launch day.

---

## Part 8 — Deploy the Frontend to Vercel

### 8.1 Import the repo

Vercel dashboard → **Add New → Project** → import the Git repo.

**Critical monorepo settings:**

- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js (auto-detected)
- **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`
- **Build Command:** `cd ../.. && pnpm --filter web build`

**Why the `cd ../..`:** `apps/web` depends on the workspace package `@sgexpo/contracts` (`"workspace:*"`). If Vercel installs only inside `apps/web`, pnpm can't resolve the workspace dependency and the build fails. Running install/build from the repo root makes pnpm see the whole workspace, then `--filter web` builds just the web app.

### 8.2 Set the environment variables (Vercel → Project → Settings → Environment Variables)

Set these for **Production** (and Preview if you use preview deploys):

| Variable | Value | Why it's needed |
|----------|-------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Browser + server Supabase client (auth, content reads) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/public key from Part 7.2 | Public Supabase client key (safe to expose) |
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.34-30-155-166.sslip.io` | **Most important.** Browser code (`process.env.NEXT_PUBLIC_BACKEND_URL`) calls the API *directly* from the attendee's phone. This must be the public HTTPS API domain, not the VM IP. |
| `BACKEND_URL` | `https://api.34-30-155-166.sslip.io` | Server-side API proxy routes (`apps/web/lib/config.ts` prefers this, falls back to `NEXT_PUBLIC_BACKEND_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Part 7.2 | Used by the web magic-link API route to mint links. Server-only — never `NEXT_PUBLIC_`. |
| `RESEND_API_KEY` | `re_...` | The web magic-link route sends the login email via Resend |
| `EMAIL_FROM` | `onboarding@resend.dev` | From-address for the magic-link email (no domain yet — Resend test sender; only delivers to the Resend account owner's email until a domain is verified) |

**Why `NEXT_PUBLIC_` vs not:** Next.js inlines `NEXT_PUBLIC_*` vars into the browser bundle. `NEXT_PUBLIC_BACKEND_URL` and the Supabase URL/anon key are *meant* to be public. `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` must **never** be `NEXT_PUBLIC_` — that would leak full DB access and your email key to every visitor.

### 8.3 Deploy (no custom domain — use the Vercel URL)

- Push to the production branch (or click **Deploy**). Vercel builds and assigns a free HTTPS URL like `https://<project>.vercel.app`.
- **Note the actual URL Vercel gives you.** This guide assumes `tarsha-expo.vercel.app`; if Vercel assigns something different, that real URL is your frontend address — use it everywhere this doc says `tarsha-expo.vercel.app` (Supabase Site/redirect URLs in Part 7.4, `CORS_ALLOWED_ORIGINS` in Part 6.7 / Part 8.4).
- No custom domain, no DNS, no CNAME needed — `*.vercel.app` already has valid HTTPS.

### 8.4 Wire CORS back to the VM

Now that the Vercel domain is final, ensure the backend allows it. On the VM:

```bash
nano /opt/sgexpo/infra/docker/.env.backend
# confirm: CORS_ALLOWED_ORIGINS=https://tarsha-expo.vercel.app
```

If you change it after the stack is already running:
```bash
cd /opt/sgexpo/infra/docker
docker compose -f docker-compose.prod.yml restart backend
```

**Why:** the backend's CORS middleware only accepts requests whose `Origin` header is in `CORS_ALLOWED_ORIGINS`. The attendee's browser calls `api.34-30-155-166.sslip.io` from `tarsha-expo.vercel.app` — a cross-origin request. If the Vercel domain isn't whitelisted, every browser API call is blocked and the app appears broken even though the backend is healthy.

---

## Part 9 — DNS (nothing to configure)

**There is no DNS to set up.** Because we use `sslip.io`:

- `api.34-30-155-166.sslip.io` is a public wildcard-DNS hostname that already resolves to `34.30.155.166`. No registrar, no Cloudflare, no `A` record.
- The frontend uses Vercel's own `*.vercel.app` HTTPS URL — also no DNS.

Just confirm resolution works before bringing the stack up (run from anywhere):

```bash
nslookup api.34-30-155-166.sslip.io    # must return 34.30.155.166
# or:  dig +short api.34-30-155-166.sslip.io
```

If that returns `34.30.155.166`, Caddy will be able to obtain its Let's Encrypt certificate automatically in Part 10.

> **Future real domain:** when you buy one, add a single `A` record `api → 34.30.155.166` (DNS-only / grey cloud if using Cloudflare — a proxied/orange-cloud record breaks Caddy's Let's Encrypt HTTP challenge), point the frontend domain at Vercel per Vercel's instructions, then update the Caddyfile hostname + Vercel envs + `CORS_ALLOWED_ORIGINS`.

---

## Part 10 — Bring the Stack Up on the VM

```bash
# On the VM
cd /opt/sgexpo/infra/docker

export REGISTRY="europe-west2-docker.pkg.dev/tarsha-ai-491715/apps"
export TAG="prod"

# Pull the images you pushed in Part 5
docker compose -f docker-compose.prod.yml pull

# Start everything in the background
docker compose -f docker-compose.prod.yml up -d

# Watch it come up
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

**Why `REGISTRY` and `TAG` are exported here:** the compose file uses `image: ${REGISTRY}/backend:${TAG:-latest}`. Compose substitutes these env vars at `up` time. If you don't export them, it tries to pull `/backend:latest` and fails. (Alternatively put them in a `.env` file next to the compose file — Compose auto-loads that.)

**What `up -d` starts**, in **health-gated** dependency order (the compose file uses `depends_on: condition: service_healthy`, so each service waits until the one below it is actually *healthy*, not just started):
1. `redis` — appendonly persistence on a named volume (`redis-data`); `noeviction` so idempotency/rate-limit keys are never silently dropped; healthcheck = `redis-cli ping`
2. `backend` — waits for redis healthy; joins `internal` (→redis) and `web` (→caddy); 1 GB cap; healthcheck = `GET /health`; `init: true` (proper SIGTERM handling) + 30 s grace so in-flight scans/redemptions drain on redeploy
3. `worker` — waits for redis healthy; `internal` only; 256 MB cap; starts its 60 s poll loop; `init: true`
4. `caddy` — waits for **backend healthy** (so it never proxies to a not-ready backend → no startup 502s); binds 80/443; fetches the TLS cert on first request

> Because startup is health-gated, `up -d` takes ~20–40 s to fully settle while healthchecks pass — this is expected, not a hang. Watch `docker compose -f docker-compose.prod.yml ps` until every service shows `healthy`. All container logs are capped (`json-file`, 10 MB × 3) so an all-day event cannot fill the VM disk.

### Health check

```bash
# On the VM — bypass Caddy, hit backend directly on the Docker network
docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:8081/health

# From anywhere — through Caddy + HTTPS (the real test)
curl https://api.34-30-155-166.sslip.io/health
```

Expected response:
```json
{"ok":true,"service":"backend","db_reachable":true}
```

- `db_reachable: true` confirms the backend reached Supabase (your `DATABASE_URL` is correct).
- `curl` over `https://` succeeding confirms Caddy obtained its Let's Encrypt cert for the sslip.io host.

If `curl https://...` hangs or gives a cert error: wait ~60 s (first-request cert issuance), then check `docker compose -f docker-compose.prod.yml logs caddy`. Common causes — the firewall isn't open on 80/443 (Part 6.1), or `nslookup api.34-30-155-166.sslip.io` doesn't return `34.30.155.166` (Part 9).

---

## Part 11 — End-to-End Smoke Test (do this before event day, on a real phone on cellular)

Use a phone on **mobile data, not venue wifi**, to mirror real conditions.

- [ ] `curl https://api.34-30-155-166.sslip.io/health` → `{"ok":true,...,"db_reachable":true}`
- [ ] Open `https://tarsha-expo.vercel.app` → event landing page renders
- [ ] Join with a test email → magic link email arrives < 30s → tapping it logs you in (verifies Supabase redirect URLs + Resend + the web magic-link route)
- [ ] Home shows live score (0), rank, progress widget (verifies browser → `api.34-30-155-166.sslip.io` calls + CORS)
- [ ] Profile → My QR Code renders
- [ ] Second phone scans the QR → "+points connected" success (verifies QR signing + scan idempotency via Redis)
- [ ] Re-scan the same QR → no double points (Redis idempotency working)
- [ ] Leaderboard → both attendees ranked, anonymous aliases
- [ ] Admin login → Ops dashboard shows live stats
- [ ] Staff: create a QR campaign → activate → scan increments count
- [ ] Admin: exports download (attendees CSV, sponsor-leads CSV)
- [ ] Worker check: `docker compose -f docker-compose.prod.yml logs worker` shows the 60s poll loop running with no errors

---

## Part 12 — Redeploying After a Code Change

```bash
# Laptop — rebuild + push
export REGISTRY="europe-west2-docker.pkg.dev/tarsha-ai-491715/apps"
export TAG="prod"
docker build -f apps/backend/Dockerfile -t "$REGISTRY/backend:$TAG" .
docker build -f apps/worker/Dockerfile  -t "$REGISTRY/worker:$TAG"  .
docker push "$REGISTRY/backend:$TAG"
docker push "$REGISTRY/worker:$TAG"

# VM — pull + recreate (only changed containers restart)
cd /opt/sgexpo/infra/docker
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Frontend:** Vercel auto-redeploys on every push to the production branch. No manual step.

---

## Part 13 — Rollback (event-day safety)

**Backend/worker:** keep the previous image tag. To roll back, repoint and restart:
```bash
# If you tagged builds with git SHAs, e.g. backend:abc1234 was the last good one
cd /opt/sgexpo/infra/docker
TAG=abc1234 docker compose -f docker-compose.prod.yml up -d backend worker
```
This is why **building with a git-SHA tag in addition to `prod` is strongly recommended** before event day — it gives you a precise rollback target.

**Frontend:** Vercel dashboard → Deployments → pick the last good one → **Promote to Production**. One click, instant.

---

## Part 14 — Event-Day Operations (26 May 2026)

```bash
# Live tail (run on the VM)
cd /opt/sgexpo/infra/docker
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker

# Quick health
curl https://api.34-30-155-166.sslip.io/health

# Resource usage
docker stats

# Restart a single service without touching the others
docker compose -f docker-compose.prod.yml restart backend
```

- **Vercel dashboard → Functions tab:** any frontend/SSR errors.
- **Supabase dashboard → Database → Connections:** watch the pool isn't exhausted under load.
- **Resend dashboard:** confirm email delivery (magic links, notification fanout).

### Post-event

1. Admin → Ops → "Send emails" → connection-summary emails to all attendees (worker fans these out).
2. Admin → `/admin/exports` → download attendees, sponsor-leads, leaderboard CSVs.
3. Transition the event to `post_event` state (10-day attendee archive window).
4. Cost saving: after the archive window, stop the stack (`docker compose down`) or resize the VM down to `e2-small`.

---

## Quick Reference Cheat Sheet

```bash
# ── Laptop: build + push (run from repo root) ──
export REGISTRY="europe-west2-docker.pkg.dev/tarsha-ai-491715/apps" TAG="prod"
docker build -f apps/backend/Dockerfile -t "$REGISTRY/backend:$TAG" .
docker build -f apps/worker/Dockerfile  -t "$REGISTRY/worker:$TAG"  .
docker push "$REGISTRY/backend:$TAG" && docker push "$REGISTRY/worker:$TAG"

# ── VM: deploy (always run from infra/docker so the Caddyfile path resolves) ──
cd /opt/sgexpo/infra/docker
export REGISTRY="europe-west2-docker.pkg.dev/tarsha-ai-491715/apps" TAG="prod"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# ── Verify ──
curl https://api.34-30-155-166.sslip.io/health     # {"ok":true,"service":"backend","db_reachable":true}

# ── Logs / restart ──
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml restart backend
```

### Values — what's fixed vs. what you still fill in

| Token | Status |
|-------|--------|
| `tarsha-ai-491715` | ✅ fixed — your GCP project ID |
| `api.34-30-155-166.sslip.io` | ✅ fixed — sslip.io API host, resolves to the VM, no DNS setup |
| `34.30.155.166` / `10.128.0.2` | ✅ fixed — VM external / internal IP |
| `europe-west2` | ✅ fixed — GCP region |
| `tarsha-expo.vercel.app` | ⚠️ assumed — replace with the real `*.vercel.app` URL Vercel assigns (Part 8.3) |
| `<your-vm-name>` / `<your-zone>` | ✏️ fill in — the GCP VM name and its zone |
| `YOUR_PROJECT` (Supabase) | ✏️ fill in — Supabase project ref (Part 7) |
| Supabase keys / `re_...` Resend key / Part 2 secrets | ✏️ fill in — from the respective dashboards |

---

## Appendix — Why each platform, in one line each

- **Vercel (frontend):** made by the Next.js team; zero-config, global edge CDN, auto-HTTPS, one-click rollback — ideal for 500 phones hitting a mobile web app.
- **GCP Compute Engine VM + Docker Compose (backend/worker/redis):** a persistent API with a DB pool + a 60s background poll loop + co-located Redis cannot run serverless; one small VM gives full control and trivial rollback.
- **Docker multi-stage + `tsx/esm`:** the `@sgexpo/domain` package ships `.ts` source, so we run TypeScript directly with the `tsx` Node loader instead of a `tsc` build step.
- **Caddy:** automatic free Let's Encrypt TLS with no cert management, plus the single hardened public entry point in front of the private backend.
- **Artifact Registry:** private, same-region image storage the VM pulls from using its built-in service account — no extra credentials.
- **Supabase:** managed Postgres + magic-link auth, already the system of record.
- **Resend:** transactional email (magic links + notification fanout), already integrated.
```
