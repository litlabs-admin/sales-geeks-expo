# Deployment — Step by Step (existing `tarsha` VM, first-timer)

Written for someone who has **never deployed anything**. We deploy onto the **existing tarsha VM** (it already runs another app — this guide makes sure the two cannot collide). Follow top to bottom, do not skip. Every step ends with a **✓ CHECK** — do not continue until it passes.

You will deploy:
- **Backend + worker + cache (Redis)** → the tarsha VM, using Docker
- **Frontend (the phone website)** → Vercel, connected to GitHub

All commands run in the **VSCode integrated terminal** (Terminal → New Terminal, or `Ctrl + ~`; make sure it says **PowerShell**). Steps marked **(PC terminal)** run on your computer; **(VM)** steps run after you SSH into the server (same window, now connected to the VM).

> ### How this coexists with the existing tarsha app (no conflict by design)
> The tarsha VM already runs another deployment whose **Caddy** (`tarsha-caddy-1`) owns ports 80/443 and already does Let's Encrypt. SalesGeek therefore **does not run its own Caddy** — we start only `redis + backend + worker` (so nothing competes for 80/443) and add **one extra site block** to the existing Caddy for `api.34-30-155-166.sslip.io` (Step 6.4). It's additive, applied with a graceful reload (no downtime for tarsha), and fully reversible. The SalesGeek Docker stack is also namespaced `sgexpo-*`, so containers/networks/volumes can never clash with `tarsha-*`. Step 2 inspects the VM first; Step 5.1 still sanity-checks ports before we touch anything.

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

# PHASE 5 — Confirm the proxy situation, then create secrets (VM)

### Step 5.1 — 🚦 Identify what owns 80/443 (it should be the tarsha Caddy)
```bash
sudo ss -tlnp '( sport = :80 or sport = :443 )'
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```
**Decide based on the output:**
- **`tarsha-caddy-1` (image `caddy:*`) owns 80/443** → ✅ expected and good. This is exactly what we integrate with in Step 6.4. Continue to Step 5.2. **Do NOT stop it.**
- **Nothing on 80/443** → also fine; Step 6.4 still works (the existing Caddy serves the new site even with no other site live).
- **Something that is NOT a Caddy/Traefik/Nginx-Proxy-Manager owns 80/443** (e.g. a bare app, or a proxy you can't add a site to) → **stop here and paste the `docker ps` output** — integration differs and forcing past this will fail.

✓ CHECK: you know the name + image of whatever holds 80/443, and it's the tarsha Caddy (or nothing). Then continue.

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

### Step 6.2 — Start WITHOUT Caddy (the existing tarsha Caddy will front us)
This VM's existing `tarsha-caddy-1` already owns 80/443 and already does Let's Encrypt. We do **not** run a second Caddy. Start only the three SalesGeek services (note the explicit list — no `caddy`):
```bash
sudo docker compose -f docker-compose.prod.yml up -d redis backend worker
```
✓ CHECK:
```bash
sudo docker compose -f docker-compose.prod.yml ps
```
`redis backend worker` all `Up`; within ~40s `redis` and `backend` show `(healthy)` (re-run until they do). `tarsha-*` containers are still `Up` and untouched.

### Step 6.3 — Backend health (internal)
```bash
sudo docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:8081/health
```
✓ CHECK: `{"ok":true,"service":"backend","db_reachable":true}`. If `db_reachable:false` → fix `DATABASE_URL` in `.env.backend` (5.3), then re-run the Step 6.2 `up` line.

### Step 6.4 — Plug into the existing tarsha Caddy (additive, no downtime)
**a. Attach the existing Caddy to SalesGeek's network** so it can reach the backend by name:
```bash
sudo docker network connect sgexpo_web tarsha-caddy-1
```
**b. Back up, then add one site block** to the existing Caddyfile:
```bash
sudo cp /opt/tarsha/Caddyfile /opt/tarsha/Caddyfile.bak
sudo nano /opt/tarsha/Caddyfile
```
Keep the existing block, add the new one below so the file reads **exactly**:
```
34.30.155.166.nip.io {
    reverse_proxy api:8000
}

api.34-30-155-166.sslip.io {
    reverse_proxy sgexpo-backend-1:8081
}
```
Save: **Ctrl+O**, **Enter**, **Ctrl+X**.

**c. Graceful reload** (zero dropped requests for the tarsha app):
```bash
sudo docker exec tarsha-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```
If that errors with an adapter message, run instead:
```bash
sudo docker exec tarsha-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```
✓ CHECK: command returns with no error; `sudo docker ps` still shows `tarsha-caddy-1` and all `tarsha-*` Up.

### Step 6.5 — Verify both apps over HTTPS (any browser)
```
https://api.34-30-155-166.sslip.io/health     → SalesGeek health JSON
https://34.30.155.166.nip.io                  → existing tarsha app still works
```
✓ CHECK: first returns `{"ok":true,"service":"backend","db_reachable":true}` (wait up to 60s the first time while Caddy issues the new cert); second is unchanged — proving coexistence. If the first 502s: re-check Step 6.4a (network connect) and that the Caddyfile block names `sgexpo-backend-1:8081` exactly; then `sudo docker exec tarsha-caddy-1 caddy reload --config /etc/caddy/Caddyfile`.

> **Reversal** (if ever needed): `sudo cp /opt/tarsha/Caddyfile.bak /opt/tarsha/Caddyfile`, reload Caddy, `sudo docker network disconnect sgexpo_web tarsha-caddy-1`. Tarsha is back exactly as before.
> **Durability:** Step 6.4a is runtime-only. If `tarsha-caddy-1` is ever recreated (tarsha redeploy), re-run it.

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
  sudo docker compose -f docker-compose.prod.yml restart backend
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
- [ ] (VM) `sudo docker compose -f docker-compose.prod.yml logs worker | tail -20` → poll running, no repeating errors.
- [ ] The other deployment still works (open its URL) — confirms no collision.

✓ CHECK: every box ticked → **deployed, with both apps coexisting.**

---

# Updating later

**Frontend:** push to `main` → Vercel auto-rebuilds.
**Backend/worker:** SSH in (Step 1.6), then:
```bash
cd /opt/sgexpo && git pull
cd infra/docker
sudo docker compose -f docker-compose.prod.yml build
sudo docker compose -f docker-compose.prod.yml up -d redis backend worker
```
(No Caddy here — the tarsha Caddy keeps fronting us. If `sgexpo-backend-1` was recreated and the API 502s, re-run Step 6.4a: `sudo docker network connect sgexpo_web tarsha-caddy-1`.)
✓ CHECK: `https://api.34-30-155-166.sslip.io/health` still healthy; tarsha app unaffected.

---

# If something breaks

(VM) from `/opt/sgexpo/infra/docker`:
```bash
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs backend | tail -50
sudo docker compose -f docker-compose.prod.yml restart backend
sudo docker compose -f docker-compose.prod.yml up -d redis backend worker   # re-apply after editing a .env
sudo docker logs tarsha-caddy-1 | tail -50                                  # cert / proxy issues live HERE
```
- API 502 / cert error on `api.34-30-155-166.sslip.io` → check `sudo docker logs tarsha-caddy-1`; confirm Step 6.4a network connect, the Caddyfile block names `sgexpo-backend-1:8081`, and the firewall tag (Step 1.5). Wait 1–2 min for first cert.
- `db_reachable:false` → wrong `DATABASE_URL` in `.env.backend`; re-run Step 6.2 `up` line.
- Frontend loads but actions fail → `VERCEL_URL` not in `CORS_ALLOWED_ORIGINS` (Step 7.4).
- Remove this stack without touching tarsha: `sudo docker compose -f docker-compose.prod.yml down` (only `sgexpo-*` objects), then `sudo docker network disconnect sgexpo_web tarsha-caddy-1` and restore `/opt/tarsha/Caddyfile.bak` + reload.

Full reasoning for every component is in [deployment.md](deployment.md).
