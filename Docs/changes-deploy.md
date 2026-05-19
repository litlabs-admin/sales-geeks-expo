# Shipping Code Changes (after first deploy)

How to push a change live, for the **actual** running setup:

- Code lives on GitHub branch **`main`** — `https://github.com/litlabs-admin/sales-geeks-expo.git`
- **Frontend** → Vercel, **auto-deploys** on every push to `main`
- **Backend / worker / redis** → Docker on the **tarsha VM** at `/opt/sgexpo`, Compose project **`sgexpo`**, fronted by the existing `tarsha-caddy-1` (host `api.34-30-155-166.nip.io`)
- On the VM you run docker with **`sudo`** (your user isn't in the docker group)

---

## First: what did you change? (decides what you run)

| You changed… | Do |
|---|---|
| Only `apps/web` (frontend) | **Part A only** — push; Vercel auto-deploys |
| `apps/backend`, `apps/worker`, `packages/*` | **Part A + Part C** (VM rebuild) |
| Both | **A + C** |
| Only an env var / secret | See **Part D** |

(Any push to `main` also retriggers a Vercel build — harmless if the frontend didn't change.)

---

## Part A — Commit & push (on your PC, in the VSCode terminal)

```powershell
cd c:\Users\ARBAZ\litlabs\sales-geeks-expo
git checkout main
git pull origin main
git status                # review what changed
```

Stage **only the files you intend to ship** (never `git add .` — it sweeps `ruvector.db`, `.claude/…`, local files):

```powershell
git add <path/to/changed/file> <another/file>
git commit -m "short description of the change"
git push origin main
```

✓ CHECK: the commit appears at `https://github.com/litlabs-admin/sales-geeks-expo/commits/main`.

---

## Part B — Frontend (Vercel): automatic

Pushing to `main` automatically starts a Vercel build. Nothing to run.

- Watch: Vercel dashboard → your project → **Deployments** → newest entry.
- ✓ CHECK: status goes **Building → Ready**, open the site, hard-refresh (Ctrl/Cmd-Shift-R) to bypass cache.
- If it fails: open the deployment → **Build Logs**, copy the error.

---

## Part C — Backend / worker (the tarsha VM)

### C1. SSH into the VM (VSCode terminal)
```powershell
gcloud compute ssh tarsha-vm --zone <ZONE> --project tarsha-ai-491715
```
(Use the same `<ZONE>` you used during setup. If you set up the credential helper in **Part E**, `git pull` below is non-interactive.)

### C2. Pull the new code (on the VM)
```bash
cd /opt/sgexpo
git pull origin main
```
> Your `/opt/sgexpo/infra/docker/.env.backend` and `.env.worker` are git-ignored — `git pull` never touches or overwrites them.

### C3. Rebuild and restart (on the VM)
```bash
cd /opt/sgexpo/infra/docker
sudo docker compose -f docker-compose.prod.yml build
sudo docker compose -f docker-compose.prod.yml up -d redis backend worker
```
(Note: **no `caddy`** here — the tarsha Caddy fronts us; never start a SalesGeek caddy.)

### C4. Re-point the proxy at the new container (on the VM)
`up -d` replaces the backend container with a new one (new internal IP). Force Caddy to re-resolve it — graceful, **zero downtime for the tarsha app**:
```bash
sudo docker exec tarsha-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

### C5. Verify (on the VM or any browser)
```bash
sudo docker compose -f docker-compose.prod.yml ps
curl -sS https://api.34-30-155-166.nip.io/health
```
✓ CHECK: `backend` + `redis` show `(healthy)`; health returns `{"ok":true,"service":"backend","db_reachable":true}`. Also confirm the tarsha app still works: `curl -sS -o /dev/null -w "%{http_code}\n" https://34.30.155.166.nip.io`.

---

## Part D — Changing an env var / secret

**Frontend env var** (e.g. `NEXT_PUBLIC_*`, `EMAIL_FROM`): Vercel → Settings → Environment Variables → edit → **then redeploy** (Deployments → latest → ⋯ → **Redeploy**). A settings change does **not** auto-redeploy. `NEXT_PUBLIC_*` are baked at build time, so a redeploy is mandatory.

**Backend/worker env var** (in `/opt/sgexpo/infra/docker/.env.backend` or `.env.worker`):
```bash
cd /opt/sgexpo/infra/docker
sudo nano .env.backend            # edit the value
sudo docker compose -f docker-compose.prod.yml up -d redis backend worker
```
(No rebuild needed for an env-only change — `up -d` recreates the containers with the new env. Run C4 afterwards too.)
> Never change `QR_SIGNING_SECRET` — it invalidates every issued QR code.

---

## Part E — One-time: make `git pull` on the VM non-interactive

The VM remote has no token (we removed the leaked one). Set a credential store once so pulls don't prompt every time:
```bash
git config --global credential.helper store
cd /opt/sgexpo && git pull origin main
# Username: your GitHub username
# Password: a GitHub Personal Access Token (classic, scope: repo)
```
After the first success the token is saved to `~/.git-credentials` and reused.
> Security: that file stores the token in plaintext. It's acceptable because only you have VM access. **Revoke that token if the VM is ever decommissioned**, and never reuse the token that leaked earlier.

---

## Troubleshooting

- **API returns 502 after a redeploy** → Caddy is pointing at the old container. Run **C4** (`caddy reload`). Still 502 → the network link was lost (only happens if `tarsha-caddy-1` itself was recreated): `sudo docker network connect sgexpo_web tarsha-caddy-1` then C4.
- **`db_reachable:false`** → bad `DATABASE_URL` in `.env.backend`; fix, then C3's `up` line.
- **Vercel build fails** → read its Build Logs. ESLint is already disabled at build; a `Type error:` means a real TypeScript error to fix.
- **Frontend works but actions fail (CORS)** → the live Vercel domain isn't in `CORS_ALLOWED_ORIGINS`. Fix via **Part D** (backend env).
- **Roll back frontend** → Vercel → Deployments → pick the last good one → ⋯ → **Promote to Production** (instant).
- **Roll back backend** → on the VM: `cd /opt/sgexpo && git checkout <previous-good-commit> -- . && cd infra/docker && sudo docker compose -f docker-compose.prod.yml build && sudo docker compose -f docker-compose.prod.yml up -d redis backend worker` then C4. (Return to latest later with `git checkout main -- .`.)

---

## Quick reference

```
# Frontend-only change
(PC)  git checkout main && git add <files> && git commit -m "msg" && git push origin main
      → Vercel auto-deploys. Done.

# Backend/worker change
(PC)  git add <files> && git commit -m "msg" && git push origin main
(VM)  cd /opt/sgexpo && git pull origin main
      cd infra/docker
      sudo docker compose -f docker-compose.prod.yml build
      sudo docker compose -f docker-compose.prod.yml up -d redis backend worker
      sudo docker exec tarsha-caddy-1 caddy reload --config /etc/caddy/Caddyfile
      curl -sS https://api.34-30-155-166.nip.io/health
```
