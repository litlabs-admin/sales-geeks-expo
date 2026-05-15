# Local Testing Guide — SalesGeek Expo

> All four roles (Attendee, Admin, Staff, Business) can be tested locally using dummy emails.
> Supabase auth is fully functional — the `dev_verify_url` flow auto-redirects without needing to open email.

---

## Prerequisites

Start both services:

```powershell
# Terminal 1 — Backend (Hono + Redis)
cd apps/backend && pnpm dev

# Terminal 2 — Frontend (Next.js)
cd apps/web && pnpm dev
```

Open `http://localhost:3000` — you'll see the upgraded landing page with all 4 role cards.

> **Redis required** for the scoring engine. If Redis isn't running: `docker run -d -p 6379:6379 redis`

---

## Role 1: Attendee

**Dummy email:** `attendee+sgexpo@litlabs.io`

| Step | What to do | Expected result |
|------|-----------|-----------------|
| 1 | Click **Enter attendee app** on landing page | Auto-redirects to `/sge-2026/home` |
| 2 | Check the **progress card** | Score, rank, spendable, rewards loaded with skeleton animation |
| 3 | Bottom nav | Icons for Home, Agenda, Geeks, Rewards, Board |
| 4 | Tap the **Scan QR** FAB (floating brand button) | Camera scanner overlay opens |
| 5 | Scan any QR code from admin/staff campaigns | `+X pts` animated result shown, haptic feedback |
| 6 | Check **Leaderboard** tab | 15s auto-poll; rank changes animate; your rank card at bottom |
| 7 | Check **Profile** tab | Email, alias, score, rank, spendable, scan history |
| 8 | Scan a QR again | "Already collected" yellow warning shown |
| 9 | Scan a non-SalesGeek QR | "This QR code is not for this event" error shown |

**Scanner error states to test (manually):**
- Deny camera permission → "Camera access needed" instructions shown
- No network → network error with retry button

---

## Role 2: Admin

**Dummy email:** `admin+sgexpo@litlabs.io`

| Step | What to do | Expected result |
|------|-----------|-----------------|
| 1 | Click **Enter admin console** | Redirects to `/admin/events` |
| 2 | Navigate to **Businesses** | List of businesses with status badges |
| 3 | See "Registered — No QR" badge for seeded business | No QR yet |
| 4 | Click **Generate QR**, enter `20` points, click Generate | QR image appears on the card |
| 5 | Badge changes to **Active — QR Generated** | ✅ |
| 6 | Click **+ Add Business** tab | Create a new business |
| 7 | Navigate to **QR** | Create a misc QR campaign |
| 8 | Navigate to **Events** | See sge-2026 event |
| 9 | Navigate to **Exports** | Download attendee/sponsor CSV |
| 10 | Navigate to **Ops** | Ops dashboard metrics |

---

## Role 3: Staff

**Dummy email:** `staff+sgexpo@litlabs.io`

| Step | What to do | Expected result |
|------|-----------|-----------------|
| 1 | Click **Enter staff tools** | Redirects to `/staff/qr` |
| 2 | Create a QR: type = Guest Speaker, name = "Jane Doe keynote", 15 pts | QR appears with rendered image |
| 3 | Sign in as a **different staff email** (e.g. `staff2+sgexpo@litlabs.io`, after seeding) | Only sees their own QRs |
| 4 | Activate/deactivate a campaign | Status toggles correctly |
| 5 | Note the QR code path shown under the image | `/sge-2026/scan/<code>?sig=<sig>` |
| 6 | As attendee: scan the staff QR | +15 pts awarded |
| 7 | Staff's campaign card shows `total_scans: 1`, `unique_attendees: 1` | ✅ |

---

## Role 4: Business

**Dummy email:** `business+sgexpo@litlabs.io`

| Step | What to do | Expected result |
|------|-----------|-----------------|
| 1 | Click **Enter business portal** | Auto-signs in, redirects to `/business/dashboard` |
| 2 | **Before admin generates QR**: see "QR Code Pending" state | Amber badge, pending message |
| 3 | As Admin: go to Businesses, find "Dev Business Corp", click Generate QR (20 pts) | QR generated |
| 4 | Back in Business dashboard, refresh | QR code now visible with scan stats |
| 5 | As Attendee: scan the business QR | +20 pts |
| 6 | Business dashboard shows `Total Scans: 1`, `Unique: 1` | ✅ |
| 7 | Test `/business/register` page | Multi-step form with step indicator |

---

## Full End-to-End Flow (The Key Loop)

```
Business registers → Admin generates QR → Business sees QR → 
Attendee scans QR → +20 pts → Leaderboard updates → 
Profile scan history shows the scan
```

1. Open 4 browser tabs (one per role)
2. Follow the sequence above across tabs
3. The leaderboard should re-rank within 15 seconds

---

## Navigating Without Camera (Desktop Testing)

Since most desktops can't scan physical QRs, use **URL-based scanning**:

1. As Admin/Staff, copy the **Scan URL** shown under any QR image
2. Paste the URL directly into the browser (as the attendee user)
3. The scan landing page at `/{slug}/scan/{code}?sig={sig}` auto-awards points
4. This is equivalent to the camera scan

---

## Quick Seed / Reset

```powershell
# Re-seed all base data
pnpm dlx tsx scripts/seed-base.ts

# Seed sample businesses (some with QRs)
pnpm dlx tsx scripts/seed-businesses.ts

# Seed attendees in bulk
pnpm dlx tsx scripts/seed-attendees.ts

# Seed QR campaigns
pnpm dlx tsx scripts/seed-qrs.ts

# Seed rewards catalog
pnpm dlx tsx scripts/seed-rewards.ts
```

---

## Checking Logs

- **Backend logs**: terminal 1 (stdout JSON logs)
- **Next.js logs**: terminal 2 (Next.js dev output)
- **DB queries**: Supabase dashboard → SQL Editor → `select * from audit_logs order by created_at desc limit 20;`

---

## Known Behaviours / Edge Cases

| Behaviour | Expected |
|-----------|---------|
| Scanning same QR twice | "Already collected" — idempotent, no duplicate points |
| Business accessing dashboard before QR generated | "QR Code Pending" amber state |
| Admin trying to generate QR twice for same business | 409 Conflict error from backend |
| Staff seeing other staff's QRs | ❌ Not visible — filtered by `created_by_user_id` |
| Leaderboard updates after scan | Within 15s automatic poll, or tap Refresh |
| Scanner on desktop browser | Falls back to error if no camera — test via URL scan method |

