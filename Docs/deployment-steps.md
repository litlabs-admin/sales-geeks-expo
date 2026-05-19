# Deployment — Step by Step (for a first-time deployer)

This is written assuming you have **never deployed anything before**. Follow it top to bottom. Do not skip a step. After every step there is a **✓ CHECK** — do not move on until the check passes.

You will deploy two things:
- **Backend + worker + database-cache** → on your Google Cloud VM (using Docker)
- **Frontend (the website people open on their phone)** → on Vercel (connected to GitHub)

### Values already decided for you (copy them exactly)

| Thing | Value |
|---|---|
| GitHub repo | `https://github.com/litlabs-admin/sales-geeks-expo.git` |
| Deployment branch | `main` |
| GCP project ID | `tarsha-ai-491715` |
| VM external IP | `34.30.155.166` |
| API address (no domain needed) | `https://api.34-30-155-166.sslip.io` |
| GCP region | `europe-west2` |

> **What is "the terminal"?** On your Windows PC, press the Start key, type **PowerShell**, open **Windows PowerShell**. That black window is "the terminal". Every command in **Phase 0 and Phase 1** is typed there. Later, after you connect to the VM, you are typing into the VM's terminal instead — each step says clearly **(on your PC)** or **(on the VM)**.

---

# PHASE 0 — Code is on GitHub `main` (already done — just verify)

The important code + all deployment files have **already been committed and pushed to the `main` branch** for you. The VM downloads the code from `main`, and Vercel deploys from `main`.

### Step 0.1 — Verify it is on GitHub

Open this in your browser: `https://github.com/litlabs-admin/sales-geeks-expo/tree/main`

✓ CHECK: on the **main** branch you can see the `infra` folder, `apps/backend/Dockerfile`, and `Docs/deployment-steps.md`. **If you cannot see them, stop — do not continue until they are there.**

> **Pushing future code changes** (only when you edit code later). Junk files (`ruvector.db`, build output) must never be pushed, so add files **explicitly** — never `git add .`:
> ```powershell
> cd c:\Users\ARBAZ\litlabs\sales-geeks-expo
> git checkout main
> git add <only the files you changed>
> git commit -m "describe your change"
> git push origin main
> ```
> ✓ CHECK: your change appears on the GitHub `main` branch. (Vercel auto-redeploys the frontend; for the backend follow "Updating later" near the end of this guide.)

---

# PHASE 1 — Connect your PC to Google Cloud

### Step 1.1 — Install the Google Cloud CLI

**(on your PC)** Download and run the official installer:
`https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe`

Click through it with default options. At the end leave **"Start Google Cloud SDK Shell"** and **"Run gcloud init"** ticked.

✓ CHECK: **close PowerShell, open a new PowerShell window**, then run:
```powershell
gcloud --version
```
You see version numbers (not "not recognized"). If it says "not recognized", restart your PC and try again.

### Step 1.2 — Log in to Google Cloud

**(on your PC)**
```powershell
gcloud auth login
```
A browser opens. Pick the Google account that has access to project `tarsha-ai-491715`. Allow.

✓ CHECK: PowerShell says `You are now logged in as [your-email]`.

### Step 1.3 — Select the project

**(on your PC)**
```powershell
gcloud config set project tarsha-ai-491715
```

✓ CHECK:
```powershell
gcloud config get-value project
```
prints `tarsha-ai-491715`.

### Step 1.4 — Find your VM's name and zone

**(on your PC)**
```powershell
gcloud compute instances list
```

✓ CHECK: you see a row whose `EXTERNAL_IP` is `34.30.155.166`. **Write down its NAME and ZONE** (e.g. NAME=`sgexpo-vm`, ZONE=`europe-west2-a`). You will type these in the next steps where it says `<VM-NAME>` and `<ZONE>`.

### Step 1.5 — Firewall (you already have a rule — just verify it)

Your VM already has a firewall rule **`tarsha-allow-web`** that allows inbound `tcp:22, 80, 443` from anywhere, for instances with the network tag **`tarsha-server`**. That is exactly what this deployment needs (80 = Let's Encrypt + redirect, 443 = HTTPS API). **You do not need to create a new rule.** You only need to confirm your VM carries the `tarsha-server` tag.

**(on your PC)** — replace `<VM-NAME>` / `<ZONE>` with what you wrote down in Step 1.4:
```powershell
gcloud compute instances describe <VM-NAME> --zone <ZONE> --format="value(tags.items)"
```

✓ CHECK: the output contains `tarsha-server`.

- **If it does** → done, skip to Step 1.6. Nothing else to do.
- **If it does NOT** (the tag is missing) → add it:
  ```powershell
  gcloud compute instances add-tags <VM-NAME> --zone <ZONE> --tags=tarsha-server
  ```
  Then re-run the describe command and confirm `tarsha-server` now appears.

> Do **not** open ports 8081, 8082, or 6379. The backend, worker, and Redis are only reachable inside the VM's private Docker network — keeping them off the firewall is the correct, secure setup. The existing rules already leave them closed.

### Step 1.6 — Connect into the VM (SSH)

**(on your PC)** — replace `<VM-NAME>` and `<ZONE>` with what you wrote down in 1.4:
```powershell
gcloud compute ssh <VM-NAME> --zone <ZONE> --project tarsha-ai-491715
```
The first time it creates a key and may ask to continue — type `y`. (If it asks for a passphrase, just press Enter twice for no passphrase.)

✓ CHECK: your PowerShell prompt changes to something like `your-name@<VM-NAME>:~$`. **You are now inside the VM.** Every "(on the VM)" step below is typed in this same window. To leave the VM later you type `exit`; to come back, run this same command again.

---

# PHASE 2 — Set up the VM (one time only)

### Step 2.1 — Install Docker on the VM

**(on the VM)** run these one at a time:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```
Now **log out and back in so the permission applies**:
```bash
exit
```
Then re-connect (same command as Step 1.6):
```powershell
gcloud compute ssh <VM-NAME> --zone <ZONE> --project tarsha-ai-491715
```

✓ CHECK: **(on the VM)**
```bash
docker --version
docker compose version
docker ps
```
All three print something and `docker ps` does **not** say "permission denied".

### Step 2.2 — Make a GitHub access token (so the VM can download private code)

Your repo is private, so the VM needs a token to download it.

In your browser: GitHub → click your avatar → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
- Note: `sgexpo-vm`
- Expiration: 30 days
- Tick the **`repo`** checkbox
- **Generate token** → **copy the token now** (looks like `ghp_xxxxxxxx`). You will not see it again.

✓ CHECK: you have the token text saved somewhere temporary.

### Step 2.3 — Download the code onto the VM

**(on the VM)** — replace `YOUR_TOKEN` with the token from 2.2:
```bash
cd /opt
sudo mkdir -p sgexpo
sudo chown -R $USER:$USER sgexpo
git clone https://YOUR_TOKEN@github.com/litlabs-admin/sales-geeks-expo.git sgexpo
cd sgexpo
git checkout main
```

✓ CHECK: **(on the VM)**
```bash
ls infra/docker/docker-compose.prod.yml apps/backend/Dockerfile
```
both paths print with no "No such file" error.

---

# PHASE 3 — Create the secret settings on the VM

The app needs passwords/keys. These live in two files **on the VM only** and are never uploaded to GitHub.

### Step 3.1 — Generate the two app secrets

**(on the VM)**
```bash
openssl rand -hex 32
openssl rand -hex 32
```
Copy **both** long strings into a safe note (password manager). Label them `QR_SIGNING_SECRET` and `CALENDLY_WEBHOOK_SECRET`.

✓ CHECK: you have two different 64-character strings saved. (You will paste them in Step 3.3. **Never change `QR_SIGNING_SECRET` later** or every printed QR code stops working.)

### Step 3.2 — You need Supabase values now — go do PHASE 4, then come back here

Open **PHASE 4** below, do all of it, then return to Step 3.3 with the Supabase values in hand.

### Step 3.3 — Create the backend secrets file

**(on the VM)**
```bash
cd /opt/sgexpo/infra/docker
nano .env.backend
```
A text editor opens. Type/paste this, filling every `<...>` with your real values:
```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-ref>.supabase.co
DATABASE_URL=<supabase pooler connection string from Step 4.3>
SUPABASE_JWT_SECRET=<supabase jwt secret from Step 4.3>
SUPABASE_SERVICE_ROLE_KEY=<supabase service_role key from Step 4.3>
REDIS_URL=redis://redis:6379
CORS_ALLOWED_ORIGINS=https://tarsha-expo.vercel.app
QR_SIGNING_SECRET=<first string from Step 3.1>
CALENDLY_WEBHOOK_SECRET=<second string from Step 3.1>
RESEND_API_KEY=re_<your resend api key>
RESEND_FROM_EMAIL=onboarding@resend.dev
```
Save and exit nano: press **Ctrl+O**, then **Enter**, then **Ctrl+X**.

✓ CHECK: `cat .env.backend` shows your file with no `<...>` left unfilled.

### Step 3.4 — Create the worker secrets file

**(on the VM)**
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
Save: **Ctrl+O**, **Enter**, **Ctrl+X**.

✓ CHECK: `cat .env.worker` shows 5 filled lines.

> `RESEND_FROM_EMAIL=onboarding@resend.dev` is a shared test sender — it only delivers email to the address that owns your Resend account. Fine for testing (use that email as your test user). For the real event you need a domain + verified Resend sender.

Now continue to **PHASE 5**.

---

# PHASE 4 — Prepare Supabase (in your browser)

### Step 4.1 — Create the database project

Go to `https://supabase.com/dashboard` → **New project**.
- Name: `salesgeek-prod`
- Region: **West EU (London)**
- Set a strong database password and save it.

✓ CHECK: project shows green "Healthy" / "Active" after a minute or two.

### Step 4.2 — Create the database tables (run the migrations in order)

In the Supabase project: left sidebar → **SQL Editor** → **New query**.
On your PC, the SQL files are in the repo at `supabase/sql/`. Open each file, copy all its text, paste into the SQL Editor, click **Run**. Do them **strictly in this order**:
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

✓ CHECK: each run says "Success". After `0010`, run `select count(*) from events;` — it returns a number (0 is fine), not an error.

### Step 4.3 — Copy the connection values

In Supabase: **Project Settings** (gear icon).
- **Database** → "Connection string" → **Transaction** mode, port `5432` → copy → this is your `DATABASE_URL`.
- **API** → copy **Project URL**, **anon public** key, **service_role** key.
- **API → JWT Settings** → copy **JWT Secret**.

✓ CHECK: you have 5 values saved: Project URL, anon key, service_role key, JWT secret, DATABASE_URL connection string.

### Step 4.4 — Allow login redirects

Supabase → **Authentication** → **URL Configuration**:
- **Site URL:** `https://tarsha-expo.vercel.app`
- **Redirect URLs:** add `https://tarsha-expo.vercel.app/**`
- Save. (If Vercel later gives you a different address, come back and fix these — Step 6.4.)

✓ CHECK: both fields saved.

**Now go back to PHASE 3, Step 3.3** and fill in the secret files with these values.

---

# PHASE 5 — Build and start the backend on the VM

### Step 5.0 — ⚠️ Check ports 80 and 443 are FREE (you have another deployment on this VM)

You already run something else on this VM. **Two programs cannot use the same port.** If your existing app is using port 80 or 443, Caddy will fail to start with an "address already in use" / "port is already allocated" error. Check first.

**(on the VM)**
```bash
sudo ss -tlnp '( sport = :80 or sport = :443 )'
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

✓ CHECK — read the output:
- **Nothing listed on :80 and :443** (the `ss` command prints only a header, no rows) → you are clear. Continue to Step 5.1.
- **Something IS using :80 or :443** → you have a conflict. Do **not** continue until you resolve it. Pick one:
  1. **The old thing is no longer needed** → stop it. If it's a Docker container: `docker stop <name>` (from the `docker ps` list). If it's a system service (e.g. nginx/apache): `sudo systemctl stop nginx` (and `sudo systemctl disable nginx` so it doesn't return on reboot).
  2. **The old thing must keep running** → you cannot host both on the same VM on 80/443 without extra setup. Easiest options: deploy SalesGeek on a **separate VM**, or have one shared reverse-proxy route both domains. This needs a decision — stop here and ask for help with this specific case.

> Why this matters: the SalesGeek `caddy` container binds host ports 80 and 443. The old deployment's firewall rule (`tarsha-allow-web`) and ports are fine to share at the *network* level — the conflict is only about which single program answers on 80/443 on this machine.

### Step 5.1 — Build the images on the VM

**(on the VM)**
```bash
cd /opt/sgexpo/infra/docker
docker compose -f docker-compose.prod.yml build
```
This takes a few minutes the first time (it is compiling the app). That is normal.

✓ CHECK: it ends with no red `ERROR`. Run `docker images` — you see `sgexpo/backend` and `sgexpo/worker`.

### Step 5.2 — Start everything

**(on the VM)**
```bash
docker compose -f docker-compose.prod.yml up -d
```

✓ CHECK:
```bash
docker compose -f docker-compose.prod.yml ps
```
You see 4 services: `redis`, `backend`, `worker`, `caddy`, all `Up`. Within ~40 seconds `redis` and `backend` show `(healthy)`. (Re-run the command until they do.)

### Step 5.3 — Check the backend works internally

**(on the VM)**
```bash
docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:8081/health
```

✓ CHECK: prints `{"ok":true,"service":"backend","db_reachable":true}`. If `db_reachable` is `false`, your `DATABASE_URL` in `.env.backend` is wrong — fix it (Step 3.3), then `docker compose -f docker-compose.prod.yml up -d` again.

### Step 5.4 — Check it works over the public internet (HTTPS)

From **any** machine (your PC, a new PowerShell, or your phone browser):
```
https://api.34-30-155-166.sslip.io/health
```

✓ CHECK: you get `{"ok":true,"service":"backend","db_reachable":true}`. If you get a security/certificate error, wait 60 seconds (the certificate is being issued the first time) and refresh. Still failing after 2 minutes? **(on the VM)** run `docker compose -f docker-compose.prod.yml logs caddy` and check the firewall step (1.5).

---

# PHASE 6 — Deploy the frontend on Vercel (browser, via GitHub)

### Step 6.1 — Import the GitHub repo

Go to `https://vercel.com` → sign in **with GitHub** → **Add New… → Project** → find `sales-geeks-expo` → **Import**. If asked, give Vercel access to the `litlabs-admin` repos.

✓ CHECK: you are on the "Configure Project" screen.

### Step 6.2 — Configure the build (important — it is a monorepo)

- **Root Directory:** click Edit → set to `apps/web`
- **Production Branch** (Settings → Git, after import if not shown here): `main`
- Expand **Build and Output Settings** → override:
  - **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`
  - **Build Command:** `cd ../.. && pnpm --filter web build`

✓ CHECK: Root Directory shows `apps/web`; the two commands are set.

### Step 6.3 — Add the environment variables

Still on the configure screen (or Project → Settings → Environment Variables), add each of these (Environment = **Production**):
```
NEXT_PUBLIC_SUPABASE_URL      = https://<your-supabase-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key from Step 4.3>
NEXT_PUBLIC_BACKEND_URL       = https://api.34-30-155-166.sslip.io
BACKEND_URL                   = https://api.34-30-155-166.sslip.io
SUPABASE_SERVICE_ROLE_KEY     = <service_role key from Step 4.3>
RESEND_API_KEY                = re_<your resend api key>
EMAIL_FROM                    = onboarding@resend.dev
```
Then click **Deploy**.

✓ CHECK: after a few minutes the deployment status is **Ready** and you get a URL like `https://something.vercel.app`. **Open it — the event page loads.**

### Step 6.4 — Make the addresses match

Look at the real URL Vercel gave you in 6.3.
- If it is **exactly** `https://tarsha-expo.vercel.app` → nothing to do.
- If it is **different** (e.g. `https://sales-geeks-expo.vercel.app`), update it in two places so the frontend is allowed to talk to the backend:
  1. Supabase → Authentication → URL Configuration → set Site URL and Redirect URL (`/**`) to the real URL (Step 4.4).
  2. **(on the VM)**:
     ```bash
     cd /opt/sgexpo/infra/docker
     nano .env.backend     # change CORS_ALLOWED_ORIGINS to the real https://...vercel.app URL
     docker compose -f docker-compose.prod.yml restart backend
     ```

✓ CHECK: the URL is identical in all three places: the Vercel address bar, Supabase Site URL, and `CORS_ALLOWED_ORIGINS` in `.env.backend`.

---

# PHASE 7 — Final test (use your phone on mobile data)

Open the Vercel URL on your phone (turn Wi-Fi off, use cellular, to mimic the venue).

- [ ] Event landing page loads.
- [ ] Join with the email that owns your **Resend** account → a login email arrives within ~30s → tapping it logs you in.
- [ ] Home screen shows score `0` and a rank.
- [ ] Open "My QR" on this phone. On a second phone, log in as a different test user and scan it → you see points awarded.
- [ ] Scan the **same** QR again on the second phone → **no extra points** (this proves the anti-cheat works).
- [ ] Log in as the admin → the Ops dashboard shows live numbers.
- [ ] **(on the VM)** `docker compose -f docker-compose.prod.yml logs worker | tail -20` → shows the background poll running, no repeating errors.

✓ CHECK: every box above is ticked. If so, **you are deployed.**

---

# Updating later (after you change code)

**(on your PC)** commit and push your changes:
```powershell
cd c:\Users\ARBAZ\litlabs\sales-geeks-expo
git checkout main
git add <changed files>
git commit -m "describe the change"
git push origin main
```

The **frontend updates itself** automatically (Vercel rebuilds on every push).

For the **backend/worker**, update the VM:
```powershell
gcloud compute ssh <VM-NAME> --zone <ZONE> --project tarsha-ai-491715
```
**(on the VM)**
```bash
cd /opt/sgexpo
git pull
cd infra/docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

✓ CHECK: `https://api.34-30-155-166.sslip.io/health` still returns the healthy JSON.

---

# If something breaks — first things to run

**(on the VM)**, from `/opt/sgexpo/infra/docker`:
```bash
docker compose -f docker-compose.prod.yml ps               # are all 4 Up / healthy?
docker compose -f docker-compose.prod.yml logs backend | tail -50
docker compose -f docker-compose.prod.yml logs caddy  | tail -50
docker compose -f docker-compose.prod.yml restart backend  # restart just one service
docker compose -f docker-compose.prod.yml up -d            # re-apply after editing a .env file
```
- `db_reachable:false` → wrong `DATABASE_URL` in `.env.backend`.
- Certificate error in the browser → wait 1–2 min; check firewall (Step 1.5) and `logs caddy`.
- Frontend loads but actions fail → the Vercel URL is not in `CORS_ALLOWED_ORIGINS` (Step 6.4).

The full reasoning behind every piece of this is in [deployment.md](deployment.md).
