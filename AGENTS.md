# AGENTS.md

This file gives future Codex sessions the context needed to be useful on this project from the first message.

---

## What this project is

A mobile-first event companion **web app** for **Scottish Growth Expo 2026** (26 May 2026, Hampden National Stadium, Glasgow), built and operated by **SalesGeek Scotland**.

- Branded as: *SalesGeek Scotland's event app for Scottish Growth Expo 2026*.
- Built as a **multi-event platform** (event-scoped data, slug-based URLs) — not a one-off.
- Single URL operates in three modes: **pre-event → event-day → post-event archive**.
- Forumm remains the public ticketing/listing source — this app is the operational companion product.
- Mobile web only for v1. No native, no PWA install prompts, no browser push.
- Optimized for poor venue connectivity (lightweight pages, retry-tolerant, idempotent server actions).

The project is currently in the **planning / spec phase**. No application code exists yet — the repo holds the PRD, the north star, deliverables list, and discovery docs.

---

## Repo layout (current)

```
/
├── AGENTS.md              ← this file
├── northstar.md           ← full north star (15 sections) — single source of truth for scope
└── docs/
    ├── read.md            ← original PRD (problem, solution, ~150 user stories, decisions, out-of-scope)
    ├── expo_details.md    ← summary of the SGE 2026 sponsorship/positioning deck
    ├── deliverables.md    ← simplified 20-point "what the app will do" list
    └── northstar.md       ← older snapshot of north star (root copy is the current one)
```

> Note: there's currently an in-progress merge on `main` (root `northstar.md` is staged). Don't run destructive git commands without the user's say-so.

### How the docs relate

- **`docs/read.md`** is the PRD. It's the canonical statement of *what was asked for*. ~150 numbered user stories, explicit decisions, and out-of-scope items live here.
- **`northstar.md`** (root) is the canonical statement of *what we'll deliver*. It expands the PRD into modules, deliverables, recommended additions, and discovery questions. Use this for scope discussions.
- **`docs/deliverables.md`** is the 20-point plain-English summary for non-technical stakeholders.
- **`docs/expo_details.md`** is what the organizer's pitch deck tells us about the event (audience, sponsors, agenda, brand positioning).
- **`docs/northstar.md`** is an older copy. Root `northstar.md` is newer (has sections 14 & 15 — event manager questions and required inputs).

---

## Key project facts (don't re-derive these)

- **Event date**: 26 May 2026.
- **Venue**: Hampden National Stadium, Glasgow.
- **Audience**: 350–500 capped, senior decision-makers (~35% owners/founders, ~30% director-level).
- **Agenda shape**: Registration 08:30, exhibition opens 09:00, keynotes through the day, VIP Q&A 14:15–15:00 (invite-only), closing 15:45–16:00, networking from 16:00.
- **Confirmed speakers**: Katy Morrison (11:20), Brian Williamson (13:00–14:00), Russell Dalgliesh (14:45–15:45).
- **Sponsor tiers**: 4 tiers — Strategic Headline, Growth Ecosystem, Experience Sponsor, Curated Exhibitor.
- **Exhibition stands**: 40.
- **Hosts**: Four SalesGeek "Geeks" featured in the app's Geeks tab. William is one of them and has a **distinct premium reward** (post-event strategy session, limited slots, completed via Calendly confirmation) separate from his ordinary booking link.

---

## Non-obvious product decisions to remember

These are the decisions easy to get wrong if you only skim the PRD:

- **Email is the canonical identity.** Immutable after signup (admin correction only). Phone is informational, editable. Business is locked after signup. Real name editable. Alias auto-generated with one self-service edit.
- **Two ledgers per attendee**: competition score (for leaderboard) and spendable balance (for redemptions). Spending does not reduce leaderboard rank.
- **OTP is required for prize eligibility, not for app entry.** Attendees can enter and play before verifying — keeps the registration desk flowing.
- **Auto-check-in** on first event-day app entry (staff override available).
- **QR scans auto-award on page load**, idempotent, one-per-attendee by default. Sponsor/session points visible; hidden bonus points hidden.
- **Hidden bonus QRs** are time-released with broad zone hints — not a random scavenger hunt.
- **Leaderboard is anonymous (aliases)**, top 10 + own rank, tie-breaks by earliest time reaching the score.
- **William reward**: points deducted only after Calendly booking confirmation succeeds. Inventory is fixed/app-managed, not live from Calendly. No hold state.
- **Sponsor lead sharing requires separate explicit consent** from general event terms. Interest button doesn't affect points and can be undone.
- **5-tab attendee nav**: Home, Agenda, Geeks, Rewards, Leaderboard. Sponsors, FAQs, Profile, T&Cs live outside the 5 tabs.
- **Home prioritizes live event context** (now/up-next, announcements) above game mechanics (points, rank, progress).
- **Roles**: Admin and Staff only. Staff = search, redemption, predefined point actions. Admin = arbitrary adjustments, reversals, merges, exports, configuration. Individual accounts (not shared). Passwordless via magic link / email OTP.
- **No admin impersonation in v1.** Preview-as-attendee content view only.
- **Post-event archive**: attendees retain access for 10 days. Final leaderboard visible only to logged-in attendees in that window (no public unauthenticated results page).
- **No live Forumm integration.** Attendee data comes via CSV import.

---

## Explicitly out of scope (v1)

Don't propose these without checking — they're deliberate non-goals:

Native apps, PWA install prompts, browser push, live Forumm integration, sponsor logins/dashboards, attendee directory, social sharing, session bookmarking, full dispute system, full mission engine, public final leaderboard, chatbot help, SMS OTP, passwords, full offline mode with local reconciliation, self-service attendee deletion, marketing/reminder emails, dynamic Calendly-derived reward inventory, admin impersonation.

(Full list: `northstar.md` §9 and `docs/read.md` "Out of Scope".)

---

## Build order (from the PRD)

Phases must clear end-to-end before moving on:

1. Admin event setup
2. Attendee signup and check-in
3. Agenda, Geeks, sponsors
4. QR scoring and leaderboard
5. Rewards
6. Notifications
7. Reporting and archive

---

## Testing posture

- Test **external behavior and observable outcomes**, not internals.
- Deepest target: the **scoring & redemption engine** (idempotency, both ledgers, reversals, inventory, William reconciliation).
- Identity, QR/progress, sponsor, role-based permissions, exports, and archive transitions all have dedicated behavioral test surfaces.
- Workspace is empty — no existing patterns to mirror. Prefer **deep isolated domain modules with interface-level tests** and a thin presentation layer.

---

## Open discovery (not yet answered by the client)

A 28-question discovery list for the event manager has been drafted (covers brand kit, domain, host Geeks identity, William's role and Calendly setup, sponsor list, reward catalog, QR strategy, venue zones, pre-registered attendee CSV, staff account list, email sending domain, legal/T&Cs, VIP Q&A handling, etc.). Until those answers land:

- Don't assume specific sponsor names, point values, or zones.
- Don't assume William's exact role beyond what's in the PRD.
- Don't assume the domain — leave it as a config slot.
- Don't import attendees — wait for the CSV format from the client.

The user has the question list. When they bring back answers, capture decisions back into `northstar.md` (and update this AGENTS.md if anything foundational changes).

---

## Recommended additions on the table

`northstar.md` §12 lists optional enhancements proposed beyond the PRD (idempotency keys, feature flags, rate limiting, anomaly review queue, save-to-phone guidance, connectivity indicator, bulk QR wizard, pre-flight checklist, stock-low alerts, attendee summary screen, sponsor packet generator, event clone, GDPR export/deletion endpoints, etc.). Treat them as **optional** until the client agrees in writing.

The **idempotency keys** addition is the one I'd flag as effectively required given the auditability constraint — call it out if scope discussions reopen.

---

## Working preferences for this project

- The user wants concise outputs. Long planning docs are fine when explicitly asked; conversational answers should stay short.
- Lead with the answer. Don't narrate process.
- When asked to "create a doc/file", write it. When asked to "create a list", default to inline unless the user has been creating files in the same thread (in which case ask or save it as a file with a clear name).
- Use markdown file links (`[text](path)`) for file references — this project runs inside the VSCode extension where they're clickable.
- This repo has no app code yet, so don't propose code changes until the build phase begins.
- Don't run destructive git operations (the repo currently has an in-progress merge).

---

## Quick orientation for a future session

If you're picking this up cold:

1. Read `northstar.md` end-to-end. It's the canonical scope.
2. Skim `docs/read.md` for the original user-story numbering when the user references "story N".
3. Check `docs/expo_details.md` if a question is about the event's audience, sponsor model, or brand positioning.
4. Ask the user what phase we're in — planning, discovery follow-up, or build kick-off. The repo state alone won't tell you.
