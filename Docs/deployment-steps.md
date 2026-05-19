# Deployment — Step by Step (fresh project, fresh VM, first-timer)

Written for someone who has **never deployed anything**. We are deploying onto a **brand-new GCP project and a brand-new VM** (nothing existing is touched). Follow this top to bottom. Do not skip a step. After every step there is a **✓ CHECK** — do not continue until it passes.

You will deploy:
- **Backend + worker + cache (Redis)** → a new Google Cloud VM, using Docker
- **Frontend (the phone website)** → Vercel, connected to GitHub

All commands run in the **VSCode integrated terminal**. Open it: VSCode top menu **Terminal → New Terminal** (or press `Ctrl + ~`). Make sure the dropdown on the right of the terminal says **PowerShell**. Steps are marked **(PC terminal)** = the VSCode terminal on your computer, or **(VM)** = after you have SSH'd into the server (the same terminal window, but now connected to the VM).

---

## STEP 0 — Your values sheet (fill this in as you go)

Keep this list somewhere (a note). You will create these values during the guide and reuse them constantly.

| Name | Value | You get it in |
|---|---|---|
| `PROJECT_ID` | `__________` | Step 1.4 |
| `VM_NAME` | `sgexpo-vm` (you can keep this) | Step 2.3 |
| `ZONE` | `europe-west2-a` (you can keep this) | fixed |
| `VM_IP` | `__________` | Step 2.4 |
| `API_HOST` | `api.<VM_IP>.sslip.io` (fill once you have VM_IP) | Step 2.4 |
| `VERCEL_URL` | `__________` (e.g. `https://xxxx.vercel.app`) | Step 7.1 |

Fixed values (already true, do not change):
- GitHub repo: `https://github.com/litlabs-admin/sales-geeks-expo.git`
- Branch: `main`

> Whenever a command shows `<PROJECT_ID>`, `<VM_NAME>`, `<ZONE>`, `<VM_IP>` — type your real value from the sheet, **without** the angle brackets.

---

# PHASE 0 — Code is on GitHub `main` (already done — just verify)

All the code + deployment files are already on the `main` branch.

### Step 0.1 — Verify
Open in a browser: `https://github.com/litlabs-admin/sales-geeks-expo/tree/main`

✓ CHECK: you can see the `infra` folder, `apps/backend/Dockerfile`, and `Docs/deployment-steps.md` on the **main** branch.

> Future code changes (only later, when you edit code). Never `git add .` (it sweeps junk). In the VSCode terminal:
> ```powershell
> cd c:\Users\ARBAZ\litlabs\sales-geeks-expo
> git checkout main
> git add <only the files you changed>
> git commit -m "describe the change"
> git push origin main
> ```

---

# PHASE 1 — Install tools & connect Google Cloud (PC terminal)

### Step 1.1 — Install the Google Cloud CLI
Download and run: `https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe`
Click through with default options.

✓ CHECK: **close VSCode, reopen it, open a new terminal** (`Ctrl + ~`), then:
```powershell
gcloud --version
```
You see version numbers (not "not recognized"). If "not recognized", restart your PC and retry.

### Step 1.2 — Log in
```powershell
gcloud auth login
```
A browser opens → pick your Google account → Allow.

✓ CHECK: terminal says `You are now logged in as [your-email]`.

### Step 1.3 — Create (or pick) the NEW project
If you will **create** a brand-new project (recommended for a clean start) — pick a globally-unique id (lowercase, digits, dashes), e.g. `sgexpo-prod-2026`:
```powershell
gcloud projects create sgexpo-prod-2026
```
(If that id is taken, choose another and try again.) If you already made a new project in the web console, skip the create command.

✓ CHECK:
```powershell
gcloud projects list
```
shows your new project. **Write its PROJECT_ID into your Step 0 sheet.**

### Step 1.4 — Select the project
```powershell
gcloud config set project <PROJECT_ID>
```
✓ CHECK: `gcloud config get-value project` prints your `<PROJECT_ID>`.

### Step 1.5 — Enable billing (required, or the VM cannot be created)
In a browser open: `https://console.cloud.google.com/billing` → select your new project → link a billing account (the same one your old project used is fine).

✓ CHECK:
```powershell
gcloud beta billing projects describe <PROJECT_ID>
```
shows `billingEnabled: true`. (If the `beta` command isn't available, just confirm in the billing web page that the project shows a linked billing account.)

### Step 1.6 — Turn on the Compute service
```powershell
gcloud services enable compute.googleapis.com
```
This can take 1–2 minutes.

✓ CHECK: command finishes with no error (`Operation finished successfully`).

---

# PHASE 2 — Create the new VM + firewall (PC terminal)

### Step 2.1 — Open the firewall for web traffic
```powershell
gcloud compute firewall-rules create allow-http-https --direction=INGRESS --action=ALLOW --rules=tcp:80,tcp:443 --source-ranges=0.0.0.0/0 --target-tags=http-server,https-server
```
✓ CHECK:
```powershell
gcloud compute firewall-rules list
```
shows `allow-http-https` with `tcp:80,tcp:443`. (SSH on port 22 is allowed by GCP's built-in `default-allow-ssh` — you do not add that.)

> Do **not** open ports 8081, 8082, 6379. Backend, worker and Redis stay private inside the VM. Leaving them closed is the correct, secure setup.

### Step 2.2 — Create the VM
```powershell
gcloud compute instances create sgexpo-vm --zone=europe-west2-a --machine-type=e2-standard-2 --image-family=debian-12 --image-project=debian-cloud --boot-disk-size=30GB --boot-disk-type=pd-ssd --tags=http-server,https-server
```
(Takes ~30s. `sgexpo-vm` is your `VM_NAME`; `europe-west2-a` is your `ZONE`.)

✓ CHECK:
```powershell
gcloud compute instances list
```
shows `sgexpo-vm` with `STATUS: RUNNING`.

### Step 2.3 — Confirm the name/zone in your sheet
From the list above: `VM_NAME = sgexpo-vm`, `ZONE = europe-west2-a`. Put them in the Step 0 sheet.

✓ CHECK: sheet has VM_NAME and ZONE filled.

### Step 2.4 — Get the VM's external IP and build your API address
```powershell
gcloud compute instances describe sgexpo-vm --zone europe-west2-a --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
```
It prints an IP like `203.0.113.10`.

✓ CHECK: you got an IP. **In the Step 0 sheet:**
- `VM_IP` = that IP (e.g. `203.0.113.10`)
- `API_HOST` = `api.` + that IP + `.sslip.io` (keep the dots), e.g. `api.203.0.113.10.sslip.io`
- Full API URL you will use later: `https://<API_HOST>` (e.g. `https://api.203.0.113.10.sslip.io`)

### Step 2.5 — Connect into the VM (SSH from the VSCode terminal)
```powershell
gcloud compute ssh sgexpo-vm --zone europe-west2-a --project <PROJECT_ID>
```
First time: it generates an SSH key — if it asks for a passphrase press **Enter** twice (empty); if it asks to continue type `y`.

✓ CHECK: your prompt changes to something like `yourname@sgexpo-vm:~$`. **You are now inside the VM.** Every **(VM)** step is typed in this window. To leave: `exit`. To return: run this same command again.

> Optional nicer setup: VSCode's **Remote - SSH** extension can open the VM as a workspace. Not required — the `gcloud compute ssh` terminal above is enough for everything in this guide.

---

# PHASE 3 — Set up the VM (one time)

### Step 3.1 — Install Docker (VM)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```
You were dropped back to your PC. Reconnect (Step 2.5 command):
```powershell
gcloud compute ssh sgexpo-vm --zone europe-west2-a --project <PROJECT_ID>
```
✓ CHECK: (VM)
```bash
docker --version
docker compose version
docker ps
```
All print, and `docker ps` does **not** say "permission denied".

### Step 3.2 — Make a GitHub access token (the repo is private)
Browser → GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
- Note: `sgexpo-vm`, Expiration: 30 days, tick **`repo`**, Generate, **copy the token** (`ghp_...`).

✓ CHECK: token saved temporarily.

### Step 3.3 — Download the code (VM) — replace `YOUR_TOKEN`
```bash
cd /opt
sudo mkdir -p sgexpo
sudo chown -R $USER:$USER sgexpo
git clone https://YOUR_TOKEN@github.com/litlabs-admin/sales-geeks-expo.git sgexpo
cd sgexpo
git checkout main
```
✓ CHECK:
```bash
ls infra/docker/docker-compose.prod.yml apps/backend/Dockerfile
```
both paths print, no "No such file".

### Step 3.4 — Put your VM IP into the Caddy config (VM)
```bash
nano infra/caddy/Caddyfile
```
Find the line `api.REPLACE_WITH_VM_IP.sslip.io {` and replace `REPLACE_WITH_VM_IP` with your real `VM_IP` (the raw IP with dots). Example result: `api.203.0.113.10.sslip.io {`
Save: **Ctrl+O**, **Enter**, **Ctrl+X**.

✓ CHECK:
```bash
grep sslip infra/caddy/Caddyfile
```
shows your line as `api.<your real IP>.sslip.io {` — **no** word `REPLACE_WITH_VM_IP` remaining.

---

# PHASE 4 — Supabase (browser)

### Step 4.1 — Create the database project
`https://supabase.com/dashboard` → **New project** → name `salesgeek-prod` → region **West EU (London)** → set & save a strong DB password.

✓ CHECK: project shows "Active/Healthy" after a minute.

### Step 4.2 — Create the tables (run migrations in order)
Supabase → **SQL Editor** → **New query**. On your PC the files are in `supabase/sql/`. Open each, copy all text, paste, **Run**, in this exact order:
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
✓ CHECK: each says "Success". After `0010`, run `select count(*) from events;` — returns a number, not an error.

### Step 4.3 — Copy the connection values
Supabase → **Project Settings**:
- **Database** → Connection string → **Transaction** mode, port `5432` → that is `DATABASE_URL`
- **API** → **Project URL**, **anon public** key, **service_role** key
- **API → JWT Settings** → **JWT Secret**

✓ CHECK: 5 values saved (Project URL, anon key, service_role key, JWT secret, DATABASE_URL).

### Step 4.4 — Allow login redirects
Supabase → **Authentication → URL Configuration**:
- **Site URL:** put a placeholder for now: `https://placeholder.vercel.app`
- **Redirect URLs:** add `https://placeholder.vercel.app/**`
- Save. (You will correct these in Step 7.4 once you know the real Vercel URL.)

✓ CHECK: both fields saved.

---

# PHASE 5 — Create the secret files on the VM

### Step 5.1 — Generate the two app secrets (VM)
```bash
openssl rand -hex 32
openssl rand -hex 32
```
Save both 64-char strings as `QR_SIGNING_SECRET` and `CALENDLY_WEBHOOK_SECRET`.

✓ CHECK: two different strings saved. **Never change `QR_SIGNING_SECRET` later** or printed QR codes stop working.

### Step 5.2 — Backend secrets file (VM)
```bash
cd /opt/sgexpo/infra/docker
nano .env.backend
```
Fill every `<...>`:
```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-ref>.supabase.co
DATABASE_URL=<Supabase transaction connection string from 4.3>
SUPABASE_JWT_SECRET=<JWT secret from 4.3>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from 4.3>
REDIS_URL=redis://redis:6379
CORS_ALLOWED_ORIGINS=https://placeholder.vercel.app
QR_SIGNING_SECRET=<first string from 5.1>
CALENDLY_WEBHOOK_SECRET=<second string from 5.1>
RESEND_API_KEY=re_<your resend api key>
RESEND_FROM_EMAIL=onboarding@resend.dev
```
Save: **Ctrl+O**, **Enter**, **Ctrl+X**.

✓ CHECK: `cat .env.backend` shows all lines filled, no `<...>` left.

### Step 5.3 — Worker secrets file (VM)
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

> `onboarding@resend.dev` only delivers to the email that owns your Resend account — perfect for testing (use that email as your test user). For the real event you need a domain + verified Resend sender.

---

# PHASE 6 — Build & start the backend on the VM

### Step 6.1 — Quick sanity: ports 80/443 are free (new VM, should be clear)
```bash
sudo ss -tlnp '( sport = :80 or sport = :443 )'
```
✓ CHECK: only a header line, no entries (a brand-new VM has nothing on 80/443). If something IS listed, stop and investigate before continuing.

### Step 6.2 — Build the images (VM)
```bash
cd /opt/sgexpo/infra/docker
docker compose -f docker-compose.prod.yml build
```
Takes a few minutes the first time (it compiles the app) — normal.

✓ CHECK: ends with no red `ERROR`. `docker images` shows `sgexpo/backend` and `sgexpo/worker`.

### Step 6.3 — Start everything (VM)
```bash
docker compose -f docker-compose.prod.yml up -d
```
✓ CHECK:
```bash
docker compose -f docker-compose.prod.yml ps
```
4 services `redis`, `backend`, `worker`, `caddy` all `Up`; within ~40s `redis` and `backend` show `(healthy)` (re-run until they do).

### Step 6.4 — Backend health, internal (VM)
```bash
docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:8081/health
```
✓ CHECK: `{"ok":true,"service":"backend","db_reachable":true}`. If `db_reachable:false`, fix `DATABASE_URL` in `.env.backend` (Step 5.2), then `docker compose -f docker-compose.prod.yml up -d` again.

### Step 6.5 — Public HTTPS health (any browser)
Open: `https://<API_HOST>/health` (e.g. `https://api.203.0.113.10.sslip.io/health`)

✓ CHECK: same JSON appears. If you get a certificate error, wait 60s (first-time cert) and refresh. Still failing after 2 min? (VM) `docker compose -f docker-compose.prod.yml logs caddy`, and double-check Step 3.4 (the Caddyfile must have your real IP, not REPLACE_WITH_VM_IP) and the firewall (Step 2.1). After editing the Caddyfile run `docker compose -f docker-compose.prod.yml restart caddy`.

---

# PHASE 7 — Deploy the frontend on Vercel (browser, via GitHub)

### Step 7.1 — Import the repo
`https://vercel.com` → sign in **with GitHub** → **Add New… → Project** → find `sales-geeks-expo` → **Import** (grant access to `litlabs-admin` if asked).

✓ CHECK: you are on the "Configure Project" screen.

### Step 7.2 — Configure (monorepo — important)
- **Root Directory:** Edit → `apps/web`
- **Production Branch** (Settings → Git if not shown now): `main`
- Expand **Build and Output Settings** → override:
  - **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`
  - **Build Command:** `cd ../.. && pnpm --filter web build`

✓ CHECK: Root Directory `apps/web`; both commands set.

### Step 7.3 — Environment variables (Production)
Add each (use your `<API_HOST>`, e.g. `https://api.203.0.113.10.sslip.io`):
```
NEXT_PUBLIC_SUPABASE_URL      = https://<your-supabase-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key from 4.3>
NEXT_PUBLIC_BACKEND_URL       = https://<API_HOST>
BACKEND_URL                   = https://<API_HOST>
SUPABASE_SERVICE_ROLE_KEY     = <service_role key from 4.3>
RESEND_API_KEY                = re_<your resend api key>
EMAIL_FROM                    = onboarding@resend.dev
```
Click **Deploy**.

✓ CHECK: after a few minutes status is **Ready** and you get a URL like `https://xxxx.vercel.app`. **Write it into the Step 0 sheet as `VERCEL_URL`.**

### Step 7.4 — Make all the addresses match
- Supabase → Authentication → URL Configuration → set **Site URL** = your `VERCEL_URL`, and **Redirect URLs** add `<VERCEL_URL>/**` (replace the `placeholder` ones).
- (VM):
  ```bash
  cd /opt/sgexpo/infra/docker
  nano .env.backend     # set CORS_ALLOWED_ORIGINS=<VERCEL_URL>
  docker compose -f docker-compose.prod.yml restart backend
  ```

✓ CHECK: `VERCEL_URL` is identical in three places: the Vercel address bar, Supabase Site URL, and `CORS_ALLOWED_ORIGINS` in `.env.backend`.

---

# PHASE 8 — Final test (phone on mobile data)

Open `VERCEL_URL` on your phone with Wi-Fi off.

- [ ] Event landing page loads.
- [ ] Join with the email that owns your **Resend** account → login email arrives ~30s → tapping it logs you in.
- [ ] Home shows score `0` and a rank.
- [ ] "My QR" shows. On a second phone (different test user) scan it → points awarded.
- [ ] Scan the **same** QR again → **no extra points** (anti-cheat works).
- [ ] Admin login → Ops dashboard shows live numbers.
- [ ] (VM) `docker compose -f docker-compose.prod.yml logs worker | tail -20` → background poll running, no repeating errors.

✓ CHECK: every box ticked → **you are deployed.**

---

# Updating later

**Frontend:** just push code to `main` — Vercel auto-rebuilds.
```powershell
cd c:\Users\ARBAZ\litlabs\sales-geeks-expo
git checkout main
git add <changed files>
git commit -m "describe the change"
git push origin main
```
**Backend/worker:** (PC) `gcloud compute ssh sgexpo-vm --zone europe-west2-a --project <PROJECT_ID>`, then (VM):
```bash
cd /opt/sgexpo
git pull
cd infra/docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
✓ CHECK: `https://<API_HOST>/health` still returns healthy JSON.

---

# If something breaks

(VM) from `/opt/sgexpo/infra/docker`:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend | tail -50
docker compose -f docker-compose.prod.yml logs caddy   | tail -50
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml up -d         # re-apply after editing a .env
```
- `db_reachable:false` → wrong `DATABASE_URL` in `.env.backend`.
- Certificate error → Caddyfile still has `REPLACE_WITH_VM_IP` (Step 3.4), or firewall (Step 2.1); wait 1–2 min after fixing, then `restart caddy`.
- Frontend loads but actions fail → `VERCEL_URL` not in `CORS_ALLOWED_ORIGINS` (Step 7.4).

Full reasoning for every component is in [deployment.md](deployment.md) (note: that reference doc still shows example values from an earlier VM — for the live procedure use *this* file and your Step 0 sheet).
