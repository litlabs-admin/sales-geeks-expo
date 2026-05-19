# Deployment — Step by Step (existing `tarsha` VM, first-timer)

Written for someone who has **never deployed anything**. We deploy onto the **existing tarsha VM** (it already runs another app — this guide makes sure the two cannot collide). Follow top to bottom, do not skip. Every step ends with a **✓ CHECK** — do not continue until it passes.

You will deploy:
- **Backend + worker + cache (Redis)** → the tarsha VM, using Docker
- **Frontend (the phone website)** → Vercel, connected to GitHub

All commands run in the **VSCode integrated terminal** (Terminal → New Terminal, or `Ctrl + ~`; make sure it says **PowerShell**). Steps marked **(PC terminal)** run on your computer; **(VM)** steps run after you SSH into the server (same window, now connected to the VM).

> ### ⚠️ The one thing that can break this: a port 80/443 conflict
> The tarsha VM already runs another deployment. A firewall rule controls *network* access, but **two programs cannot listen on the same port**. If the existing app uses host port 80 or 443, the new web server (Caddy) will refuse to start. **Step 5 is a hard gate that checks this before anything is built.** Everything else here is conflict-proofed (the Docker stack is fully namespaced `sgexpo-*`, so containers/networks/volumes can never clash with the other app).

---

## STEP 0 — Fixed values (already correct — do not change)

| Name | Value |
|---|---|
| GCP project | `tarsha-ai-491715` |
| VM external IP | `34.30.155.166` |
| API address | `https://api.34-30-155-166.sslip.io` |
| GitHub repo | `https://github.com/litlabs-admin/sales-geeks-expo.git` |
| Branch | `main` |

You will discover two values during the guide and should write them down:

| Name | Value | Found in |
|---|---|---|
| `VM_NAME` | `__________` | Step 1.4 |
| `ZONE` | `__________` | Step 1.4 |
| `VERCEL_URL` | `__________` | Step 7.1 |

> Where a command shows `<VM-NAME>` or `<ZONE>`, type your real value (no angle brackets).

---

# PHASE 0 — Code is on GitHub `main` (already done — verify)

### Step 0.1 — Verify
Open: `https://github.com/litlabs-admin/sales-geeks-expo/tree/main`

✓ CHECK: you see the `infra` folder, `apps/backend/Dockerfile`, and `Docs/deployment-steps.md` on the **main** branch.

> Future code changes only (never `git add .` — it sweeps junk):
> ```powershell
> cd c:\Users\ARBAZ\litlabs\sales-geeks-expo
> git checkout main
> git add <only files you changed>
> git commit -m "describe change"
> git push origin main
> ```

---

# PHASE 1 — Connect to Google Cloud & find the VM (PC terminal)

### Step 1.1 — Install the Google Cloud CLI
Download & run: `https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe` (default options).

✓ CHECK: **close VSCode, reopen, new terminal** (`Ctrl + ~`), then `gcloud --version` prints versions (not "not recognized"). If not recognized, restart the PC.

### Step 1.2 — Log in
```powershell
gcloud auth login
```
Browser opens → pick the Google account with access to project `tarsha-ai-491715` → Allow.

✓ CHECK: terminal says `You are now logged in as [your-email]`.

### Step 1.3 — Select the project
```powershell
gcloud config set project tarsha-ai-491715
```
✓ CHECK: `gcloud config get-value project` prints `tarsha-ai-491715`.

### Step 1.4 — Find the tarsha VM (name + zone)
```powershell
gcloud compute instances list
```
✓ CHECK: find the row whose `EXTERNAL_IP` is `34.30.155.166`. **Write its `NAME` → `VM_NAME` and `ZONE` → `ZONE`** into the Step 0 sheet.

### Step 1.5 — Firewall: verify the existing rule (do NOT create a new one)
The VM already has rule **`tarsha-allow-web`** (`tcp:22,80,443`, anywhere, tag `tarsha-server`) — exactly what we need. Just confirm the VM carries that tag:
```powershell
gcloud compute instances describe <VM-NAME> --zone <ZONE> --format="value(tags.items)"
```
✓ CHECK: output contains `tarsha-server`.
- If it does → done.
- If it does NOT → add it: `gcloud compute instances add-tags <VM-NAME> --zone <ZONE> --tags=tarsha-server`, then re-run the describe and confirm.

> Do **not** open ports 8081/8082/6379 — backend, worker and Redis stay private inside the VM. Leaving them closed is correct and secure.

### Step 1.6 — SSH into the VM (from the VSCode terminal)
```powershell
gcloud compute ssh <VM-NAME> --zone <ZONE> --project tarsha-ai-491715
```
First time: if asked for a key passphrase press **Enter** twice; if asked to continue type `y`.

✓ CHECK: prompt changes to `yourname@<VM-NAME>:~$`. **You are now inside the VM.** `exit` leaves it; re-run this command to return.

---

# PHASE 2 — Inspect the VM before changing anything (VM)

### Step 2.1 — See what the other deployment is using
```bash
echo "--- listeners on 80/443 ---"; sudo ss -tlnp '( sport = :80 or sport = :443 )'
echo "--- running containers ---"; docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null || echo "docker not installed yet"
echo "--- disk ---"; df -h / | tail -1
echo "--- memory ---"; free -m | awk '/Mem:/{print "total "$2"MB, available "$7"MB"}'
```
✓ CHECK — record what you see (you will act on it in Step 5):
- Whether anything is listed on **:80** or **:443**.
- Free disk on `/` (need **≥ 8 GB free** to build images).
- Available memory (need **≥ 1.5 GB available**; the stack is capped at backend 1 GB + worker 256 MB + small Redis).

> Do not stop or change the other deployment yet. We only looked.

---

# PHASE 3 — Set up Docker & the code on the VM (VM)

### Step 3.1 — Install Docker (skip if `docker ps` already worked in Step 2.1)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```
You return to your PC. Reconnect (Step 1.6 command), then:
```bash
docker --version && docker compose version && docker ps
```
✓ CHECK: all print; `docker ps` is **not** "permission denied".

### Step 3.2 — GitHub access token (private repo)
Browser → GitHub → avatar → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**: Note `sgexpo-vm`, Expiration 30 days, tick **`repo`**, Generate, **copy** the `ghp_...` token.

✓ CHECK: token saved temporarily.

### Step 3.3 — Get the code into `/opt/sgexpo` (VM) — replace `YOUR_TOKEN`
```bash
sudo mkdir -p /opt/sgexpo && sudo chown -R $USER:$USER /opt/sgexpo
if [ -d /opt/sgexpo/.git ]; then
  cd /opt/sgexpo && git fetch origin && git checkout main && git pull
else
  rmdir /opt/sgexpo 2>/dev/null
  git clone https://YOUR_TOKEN@github.com/litlabs-admin/sales-geeks-expo.git /opt/sgexpo
  cd /opt/sgexpo && git checkout main
fi
```
(This safely handles a fresh VM **and** a half-finished earlier attempt.)

✓ CHECK:
```bash
ls /opt/sgexpo/infra/docker/docker-compose.prod.yml /opt/sgexpo/apps/backend/Dockerfile
grep -m1 '^name:' /opt/sgexpo/infra/docker/docker-compose.prod.yml
```
both paths print, and the grep shows `name: sgexpo` (this is the namespace that keeps us isolated from the other deployment).

### Step 3.4 — Confirm the Caddy hostname (no edit needed)
```bash
grep sslip /opt/sgexpo/infra/caddy/Caddyfile
```
✓ CHECK: shows `api.34-30-155-166.sslip.io {`. (Already correct for this VM — nothing to change.)

---

# PHASE 4 — Supabase (browser)

### Step 4.1 — Create the project
`https://supabase.com/dashboard` → **New project** → name `salesgeek-prod` → region **West EU (London)** → set & save a strong DB password.

✓ CHECK: project shows "Active/Healthy".

### Step 4.2 — Run migrations in order
Supabase → **SQL Editor** → **New query**. Files are in `supabase/sql/` (in your local repo). Open each, copy all, paste, **Run**, in this exact order:
```
0000_extensions.sql
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
✓ CHECK: each says "Success". After `0010`: `select count(*) from events;` returns a number.

### Step 4.3 — Copy connection values
Supabase → **Project Settings**:
- **Database** → Connection string → **Transaction** mode, port `5432` → `DATABASE_URL`
- **API** → **Project URL**, **anon public** key, **service_role** key
- **API → JWT Settings** → **JWT Secret**

✓ CHECK: 5 values saved.

### Step 4.4 — Auth redirect placeholders
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://placeholder.vercel.app`
- **Redirect URLs:** add `https://placeholder.vercel.app/**`
- Save (corrected in Step 7.4).

✓ CHECK: both saved.

---

# PHASE 5 — Resolve the port conflict, then create secrets (VM)

### Step 5.1 — 🚦 GATE: ports 80 and 443 must be free
Re-check (from Step 2.1):
```bash
sudo ss -tlnp '( sport = :80 or sport = :443 )'
```
**Decide based on the output:**
- **No rows (header only)** → ✅ clear. Continue to Step 5.2.
- **Something is listening on :80 or :443** → ❌ conflict. You must resolve it before continuing. Identify it from `docker ps` (Step 2.1) or the `ss` output, then pick **one**:
  1. **The other app is not needed** → stop it. Docker: `docker stop <name>` (and `docker update --restart=no <name>` so it stays down). System service: `sudo systemctl stop <name> && sudo systemctl disable <name>`.
  2. **The other app must keep running** → you cannot serve both on 80/443 from one VM without a shared reverse-proxy. **Stop here and ask for help** with your exact `ss`/`docker ps` output — do not force past this.

✓ CHECK: re-run the `ss` command → **nothing on :80 or :443**. Only then continue.

### Step 5.2 — Generate the two app secrets (VM)
```bash
openssl rand -hex 32
openssl rand -hex 32
```
Save as `QR_SIGNING_SECRET` and `CALENDLY_WEBHOOK_SECRET`.

✓ CHECK: two different 64-char strings saved. **Never change `QR_SIGNING_SECRET` later.**

### Step 5.3 — Backend secrets file (VM)
```bash
cd /opt/sgexpo/infra/docker
nano .env.backend
```
```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-ref>.supabase.co
DATABASE_URL=<Supabase transaction connection string from 4.3>
SUPABASE_JWT_SECRET=<JWT secret from 4.3>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from 4.3>
REDIS_URL=redis://redis:6379
CORS_ALLOWED_ORIGINS=https://placeholder.vercel.app
QR_SIGNING_SECRET=<first string from 5.2>
CALENDLY_WEBHOOK_SECRET=<second string from 5.2>
RESEND_API_KEY=re_<your resend api key>
RESEND_FROM_EMAIL=onboarding@resend.dev
```
Save: **Ctrl+O**, **Enter**, **Ctrl+X**.

✓ CHECK: `cat .env.backend` — every `<...>` filled.

### Step 5.4 — Worker secrets file (VM)
```bash
nano .env.worker
```
```
NODE_ENV=production
DATABASE_URL=<same DATABASE_URL as above>
REDIS_URL=redis://redis:6379
RESEND_API_KEY=re_<your resend api key>
RESEND_FROM_EMAIL=onboarding@resend.dev
```
Save.

✓ CHECK: `cat .env.worker` shows 5 filled lines.

> `onboarding@resend.dev` only emails the address that owns your Resend account — fine for testing (use that email as your test user); for the real event you need a domain + verified Resend sender.

---

# PHASE 6 — Build & start (VM)

All commands from `/opt/sgexpo/infra/docker`. The stack is named `sgexpo`, so its containers (`sgexpo-backend-1`, …), networks and volumes are isolated from the other deployment.

### Step 6.1 — Build
```bash
cd /opt/sgexpo/infra/docker
docker compose -f docker-compose.prod.yml build
```
First build takes a few minutes (compiling the app) — normal.

✓ CHECK: ends with no red `ERROR`; `docker images` shows `sgexpo/backend` and `sgexpo/worker`.

### Step 6.2 — Start
```bash
docker compose -f docker-compose.prod.yml up -d
```
✓ CHECK:
```bash
docker compose -f docker-compose.prod.yml ps
```
4 services `redis backend worker caddy` all `Up`; within ~40s `redis` and `backend` show `(healthy)` (re-run until they do). The other deployment's containers are still `Up` and untouched.

### Step 6.3 — Backend health (internal)
```bash
docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:8081/health
```
✓ CHECK: `{"ok":true,"service":"backend","db_reachable":true}`. If `db_reachable:false` → fix `DATABASE_URL` in `.env.backend` (5.3), then `docker compose -f docker-compose.prod.yml up -d` again.

### Step 6.4 — Public HTTPS health (any browser)
Open: `https://api.34-30-155-166.sslip.io/health`

✓ CHECK: same JSON. Certificate error? Wait 60s (first-time cert) and refresh. Still failing after 2 min? (VM) `docker compose -f docker-compose.prod.yml logs caddy` — common causes: the firewall tag (Step 1.5), or something *else* grabbed 80/443 after Step 5.1 (re-check `sudo ss -tlnp '( sport = :80 or sport = :443 )'`).

---

# PHASE 7 — Frontend on Vercel (browser, via GitHub)

### Step 7.1 — Import
`https://vercel.com` → sign in **with GitHub** → **Add New… → Project** → `sales-geeks-expo` → **Import** (grant `litlabs-admin` access if asked).

✓ CHECK: on the "Configure Project" screen.

### Step 7.2 — Configure (monorepo)
- **Root Directory:** Edit → `apps/web`
- **Production Branch:** `main` (Settings → Git if not shown now)
- **Build and Output Settings** → override:
  - **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`
  - **Build Command:** `cd ../.. && pnpm --filter web build`

✓ CHECK: Root Directory `apps/web`; both commands set.

### Step 7.3 — Environment variables (Production)
```
NEXT_PUBLIC_SUPABASE_URL      = https://<your-supabase-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key from 4.3>
NEXT_PUBLIC_BACKEND_URL       = https://api.34-30-155-166.sslip.io
BACKEND_URL                   = https://api.34-30-155-166.sslip.io
SUPABASE_SERVICE_ROLE_KEY     = <service_role key from 4.3>
RESEND_API_KEY                = re_<your resend api key>
EMAIL_FROM                    = onboarding@resend.dev
```
Click **Deploy**.

✓ CHECK: status **Ready**, you get `https://xxxx.vercel.app`. **Write it as `VERCEL_URL`.**

### Step 7.4 — Make addresses match
- Supabase → Authentication → URL Configuration → **Site URL** = `VERCEL_URL`; **Redirect URLs** add `<VERCEL_URL>/**` (remove the placeholder ones).
- (VM):
  ```bash
  cd /opt/sgexpo/infra/docker
  nano .env.backend     # CORS_ALLOWED_ORIGINS=<VERCEL_URL>
  docker compose -f docker-compose.prod.yml restart backend
  ```
✓ CHECK: `VERCEL_URL` is identical in the Vercel address bar, Supabase Site URL, and `CORS_ALLOWED_ORIGINS`.

---

# PHASE 8 — Final test (phone on mobile data)

Open `VERCEL_URL` on a phone with Wi-Fi off.

- [ ] Landing page loads.
- [ ] Join with the email that owns your Resend account → login email ~30s → tap → logged in.
- [ ] Home shows score `0` and a rank.
- [ ] "My QR" shows; a second phone (different user) scans it → points awarded.
- [ ] Scan the **same** QR again → **no extra points** (anti-cheat works).
- [ ] Admin login → Ops dashboard shows live numbers.
- [ ] (VM) `docker compose -f docker-compose.prod.yml logs worker | tail -20` → poll running, no repeating errors.
- [ ] The other deployment still works (open its URL) — confirms no collision.

✓ CHECK: every box ticked → **deployed, with both apps coexisting.**

---

# Updating later

**Frontend:** push to `main` → Vercel auto-rebuilds.
**Backend/worker:** SSH in (Step 1.6), then:
```bash
cd /opt/sgexpo && git pull
cd infra/docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
✓ CHECK: `https://api.34-30-155-166.sslip.io/health` still healthy; other deployment unaffected.

---

# If something breaks

(VM) from `/opt/sgexpo/infra/docker`:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend | tail -50
docker compose -f docker-compose.prod.yml logs caddy   | tail -50
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml up -d        # re-apply after editing a .env
```
- Caddy won't start / "address already in use" → the port conflict (Step 5.1) — something else holds 80/443.
- `db_reachable:false` → wrong `DATABASE_URL` in `.env.backend`.
- Cert error → wait 1–2 min; check firewall tag (Step 1.5) and `logs caddy`.
- Frontend loads but actions fail → `VERCEL_URL` not in `CORS_ALLOWED_ORIGINS` (Step 7.4).
- Need to fully remove this stack without touching the other app: `docker compose -f docker-compose.prod.yml down` (only removes `sgexpo-*` objects).

Full reasoning for every component is in [deployment.md](deployment.md).
