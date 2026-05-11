# Tech Stack — SalesGeek Scotland Event Companion App
## Scottish Growth Expo 2026

> **Design Constraints**: Mobile-first web app optimized for poor venue connectivity. Must scale to 5,000+ concurrent users. Multi-event platform with event-scoped data and slug-based URLs. Three lifecycle modes on one URL (pre-event / event-day / post-event). Real-prize competition with full auditability.

---

## 1. Core Framework

### Next.js 14 (App Router)
- **Why**: Full-stack React framework with SSR, server components, and built-in API routes — eliminates a separate backend service for most endpoints.
- **App Router** over Pages Router: better streaming, nested layouts, React Server Components → fast first-paint on slow venue Wi-Fi.
- **Route Groups** cleanly separate attendee app `(attendee)`, admin panel `(admin)`, and staff view `(staff)` within one codebase.
- Multi-event routing via `/[eventSlug]/` at root — native platform architecture support.
- **Rendering strategy per route**:
  - Static shell + dynamic island for Home and Agenda (fast first paint, hydrate live data)
  - Full server rendering for auth-gated routes (Leaderboard, Rewards)
  - Edge Runtime for QR award endpoints (lowest latency, globally distributed)

### TypeScript (strict mode)
- Enforces domain model integrity across all layers — critical for the two-ledger architecture (`competitionScore` ≠ `spendableBalance`), role-based permissions, and audit-trail data shapes.
- Domain modules export typed interfaces; the presentation layer consumes them without re-deriving types.

---

## 2. Frontend

### React 18
- Concurrent features (Suspense, transitions) for progressive loading on the event-day Home tab — show skeleton → live data arrives.
- Server Components for Agenda, Sponsor pages, Geeks tab — eliminates client JS bundle for content that is largely read-only.

### Tailwind CSS v3
- Utility-first CSS with a **custom design token layer** in `tailwind.config.ts` for the SalesGeek Scotland brand (colors, typography, spacing, radii).
- Per-event theme overrides stored in DB and injected as CSS custom properties at layout level — admin-configurable branding without rebuilds.
- `shadcn/ui` component primitives used selectively for complex widgets (modals, dropdowns, sheets) — copied and owned in-repo, never installed as a black-box package dependency.

### Framer Motion
- Micro-animations for QR scan confirmations, leaderboard rank-change animations, reward unlock, tab transitions.
- Used sparingly — only where animation adds information (score increment) or masks perceived latency (optimistic UI).

### Zustand
- Lightweight client-side state store for:
  - Current attendee session snapshot (identity, score, notification badge count)
  - Pending pre-signup QR scan (preserved through registration flow)
  - UI state (active tab, notification panel open/closed)
- Chosen over Redux / Context for minimal bundle size — venue connectivity is the primary performance constraint.

### TanStack Query (React Query v5)
- Server state: caching, background refetch, automatic retry with exponential backoff + jitter — handles flaky venue Wi-Fi.
- Optimistic mutations for QR scan award (show confirmation instantly, reconcile with server result).
- Stale-while-revalidate for Leaderboard — show last known ranking, quietly refetch every 30 s.

---

## 3. Backend & API Layer

### Next.js Route Handlers (API)
- All endpoints live in `/app/api/` as Route Handlers.
- **Edge Runtime**: QR award, leaderboard read, session check — low latency.
- **Node.js Runtime**: admin operations, CSV export, email sending, CSV import — full Node.js APIs required.

### tRPC v11
- Type-safe RPC layer on top of Next.js Route Handlers.
- Eliminates API contract drift — TypeScript types ARE the contract.
- Routers organized per domain module:

| Router | Scope |
|---|---|
| `attendee.router` | Signup, OTP, profile, scan history |
| `qr.router` | Code resolution, award, already-collected |
| `scoring.router` | Ledger queries, adjustments |
| `rewards.router` | Catalog, redemption, William flow |
| `leaderboard.router` | Top-10 read, own rank |
| `admin.router` | All admin operations |
| `staff.router` | Redemption, predefined actions, attendee search |
| `notification.router` | Send, schedule, feed |
| `sponsor.router` | Interest toggle, scan status, lead export |

- tRPC middleware enforces role-based access per procedure — role check happens in the transport layer, not ad-hoc per handler.

### Domain Engine Architecture (6 Isolated Modules)

| Module | Responsibility |
|---|---|
| `ScoringEngine` | QR award, idempotency, leaderboard score, spendable balance, reversals |
| `IdentityService` | Canonical email, OTP state machine, pre-reg continuation, check-in, archive expiry |
| `QRSystem` | Code resolution, time windows, reveal windows, scan preservation, category summaries |
| `RewardEngine` | Inventory tracking, per-attendee limits, redemption, reversal, William Calendly reconciliation |
| `SponsorLayer` | Scan capture, interest toggle, consent-aware lead visibility, export shaping |
| `AuditEngine` | who/what/when/why on every sensitive write — append-only, queryable |

Each module is a pure TypeScript class with constructor-injected dependencies (DB client, Redis client, logger) — fully testable without HTTP layer.

---

## 4. Database

### PostgreSQL 15+
- **Why**: Relational integrity for prize-critical data. Foreign keys, constraints, and `SELECT FOR UPDATE` row-locking enforce invariants (no double-credit, no over-redemption of inventory).
- Two-ledger architecture enforced at DB level: `competition_score` and `spendable_balance` are separate columns on `AttendeeEventRecord` — cannot be conflated by any query.
- Audit log is a first-class append-only table (`AuditEntry`) — no `UPDATE` ever touches audit rows.

### Prisma ORM v5
- Type-safe generated client.
- **Prisma Middleware** injects `eventId` on every query given the request context — multi-event scoping is guaranteed at the data layer, not just the application layer.
- `$transaction()` used for all multi-table writes: QR award = `ScanRecord` insert + `AttendeeEventRecord` score update + `AuditEntry` insert, all atomic.
- `prisma migrate deploy` runs automatically on every deployment.

### Schema Overview (Simplified)
```
Event
  ├── AttendeeEventRecord    (attendee × event: both ledgers, OTP state, check-in, alias)
  ├── QRCode                 (type, points, timing, zone, visibility, signing hash)
  ├── ScanRecord             (idempotency key, attendee, QR, timestamp, points awarded)
  ├── Reward                 (cost, inventory, type, expiry, limits)
  ├── RedemptionRecord       (attendee, reward, state, staff attribution)
  ├── AgendaSession          (sessions, speakers, live status, sponsor link)
  ├── Sponsor                (pages, consent, interest, lead config)
  ├── Notification           (body, schedule, delivery log)
  └── AuditEntry             (actor, action, target, reason, timestamp — append only)

Attendee                     (global identity — email is canonical key)
  └── AttendeeEventRecord    (per-event participation record)
```

---

## 5. Authentication & Sessions

### Attendee: Custom Email OTP
- OTP issued and verified by `IdentityService` — no third-party auth provider for attendees.
- 6-digit code, SHA-256 hashed at rest, 10-minute TTL, max 5 verification attempts → lockout.
- Rate limit: 3 OTP issuance requests per email per 15 minutes (Redis sliding window).
- **Attendees enter the app before OTP verification** — session created on signup, `isVerified` flag set on successful OTP. Prize eligibility gated on `isVerified`.
- Session stored as httpOnly, SameSite=Strict, Secure cookie via `iron-session`.

### Admin/Staff: Magic Link (Custom)
- Time-limited signed JWT (15-minute TTL) sent to admin/staff email.
- JWT signed with `ADMIN_AUTH_SECRET` via `jose`.
- Single-use: invalidated in Redis after first use.
- Session cookie same mechanism as attendee (`iron-session`) but with `role: admin | staff` payload.

### Session Architecture
- `iron-session` encrypted session cookies — opaque to client, validated server-side.
- Session schema carries: `type (attendee|admin|staff)`, `attendeeId | staffId`, `eventId`, `isVerified`.
- `eventId` in session validated against URL slug on every request — cross-event access impossible.

---

## 6. Caching, Idempotency & Rate Limiting

### Redis (Upstash — serverless-compatible HTTP API)

| Use | Mechanism |
|---|---|
| QR scan idempotency | Redis key `scan:{attendeeId}:{qrCodeId}` set before DB write; on retry returns cached result |
| Reward redemption idempotency | Redis key `redeem:{attendeeId}:{rewardId}` same pattern |
| OTP rate limit | Sliding window counter — 3 OTP requests / email / 15 min |
| QR scan rate limit | 10 scans / attendee / minute (anti-farming) |
| Leaderboard cache | Top-10 JSON, 30-second TTL, invalidated on score change |
| Magic link invalidation | Single-use key for admin magic links |
| Notification queue | Sorted set, score = delivery Unix timestamp, polled by worker |

### CDN / Edge Caching
- Static assets: aggressive CDN TTL.
- Agenda + Sponsor page responses: `stale-while-revalidate=30`.
- QR award endpoints: `Cache-Control: no-store` — idempotency at app layer only.

---

## 7. Email

### Resend
- Transactional email: OTP, admin/staff magic links, William booking confirmation relay.
- **React Email** templates — type-safe, version-controlled, previewable in dev with `email.dev`.
- From-address configurable per event in admin panel (maps to a verified Resend sending domain — SPF/DKIM/DMARC managed in Resend).
- Delivery status webhook captured for audit purposes.

---

## 8. QR Code Generation & Print Exports

### `qrcode` (Node.js)
- Server-side QR generation — SVG and PNG output.
- QR payload: `https://[domain]/[eventSlug]/scan/[code]` signed with HMAC-SHA256 using event secret — prevents QR URL spoofing.

### `@vercel/og` (Satori-based)
- Print-ready branded card export — QR image + name + logo composed in a JSX template, rendered as PNG.
- Admin can download A5/A4/table-tent format cards per QR.
- Bulk export: ZIP of all cards via `jszip`.

---

## 9. File Storage

### Cloudflare R2 (S3-compatible)
- Venue floorplan, sponsor logos, speaker headshots, Geek photos, event hero imagery, QR print exports.
- Zero egress cost; served via Cloudflare CDN.
- Uploads via pre-signed URL directly from browser to R2 — no upload through Next.js server.
- Next.js `<Image>` component with R2 as remote image source for automatic WebP + responsive sizing.

---

## 10. Background Jobs

### Vercel Cron Jobs (or Railway Cron)
- **Scheduled notifications**: runs every minute, checks Redis notification queue, delivers due items.
- **Archive transition**: daily — checks event lifecycle, auto-transitions state, expires attendee access after 10 days.
- **Reward expiry**: daily — marks expired rewards.
- **William booking reconciliation**: every 5 minutes — checks pending Calendly confirmations against app inventory.

### Calendly Webhook (William Reward)
- Endpoint: `POST /api/webhooks/calendly/[eventSlug]`
- Validates HMAC-SHA256 signature from Calendly.
- Extracts invitee email → matches to attendee → completes `RedemptionRecord`, deducts `spendableBalance`.
- Idempotency key prevents double-processing on Calendly retry.

---

## 11. Deployment & Infrastructure

### Platform: Railway (recommended)

```
Railway Services:
├── next-app     →  Next.js 14 web service (web process)
├── postgres     →  PostgreSQL 15 managed instance
├── redis        →  Redis (or Upstash external — HTTP API)
└── worker       →  Cron/background jobs (same monorepo, separate entry point)
```

### Environments

| Environment | URL | Purpose |
|---|---|---|
| `production` | `app.salesgeek.scot` | Live event |
| `staging` | `staging.salesgeek.scot` | Client UAT |
| `preview` | PR-level auto-deploy | Dev review |

### Alternative Hybrid
- Vercel for Next.js app (Edge Functions, global CDN)
- Railway for Postgres + Redis + worker
- Upstash for Redis if Vercel-native deployment preferred

---

## 12. CI/CD

### GitHub Actions

| Trigger | Pipeline |
|---|---|
| PR opened | ESLint, TypeScript check, Vitest unit tests |
| Merge to `staging` | Full test suite + build + deploy to staging |
| Tag `vX.Y.Z` | Manual approval gate → deploy to production + run migrations |

- `prisma migrate deploy` runs automatically pre-deploy.
- Secrets in GitHub Secrets → environment variables at build time.
- Branch strategy: `feature/*` → PR → `staging` → `main` (production).

---

## 13. Monitoring & Observability

### Sentry
- Client + server error tracking, performance transactions, release tracking.
- Alert: any 5xx spike → Slack notification to on-call.
- Critical transactions traced: QR award flow, reward redemption, leaderboard query.

### PostHog
- Product analytics (page views, tab switches, QR scan funnel, reward redemption funnel).
- **Feature flags** — hot-disable specific QRs, rewards, or whole modules during the event without redeploy.
- Session recording (no PII in recordings; notified in T&Cs).

### Structured Logging: `pino`
- JSON logs at all server-side code paths.
- Log levels: `info` for domain actions, `warn` for recoverable, `error` for needs-attention.
- Shipped to Railway log drain → Betterstack Logs.

### Uptime Monitoring: Better Uptime / Checkly
- Synthetic monitors: `/health`, leaderboard endpoint, QR scan endpoint.
- Alert on >30 s downtime — critical on event day.

---

## 14. Testing Stack

### Vitest
- Unit + integration tests for all domain modules.
- Tests live alongside source (`scoring-engine.test.ts` next to `scoring-engine.ts`).
- Fast, native ESM, TypeScript-first — no Jest overhead.

### @testing-library/react + jsdom
- Component tests for complex UI: QR confirmation screen, leaderboard rendering, reward state cards.

### Playwright
- E2E tests for critical journeys against staging environment:
  1. Signup → OTP → check-in → QR scan → leaderboard rank update
  2. Admin creates QR → attendee scans → score verified in admin panel
  3. Staff redeems reward → inventory decrements → audit log entry created
  4. Archive transition → attendee access expires → admin reopens

### Prisma Test Environment
- Isolated Postgres DB per CI run (Docker).
- `prisma migrate reset` before each integration suite.
- Domain module tests hit a real test DB — no mocking of the data layer.

---

## 15. Security Controls

| Concern | Control |
|---|---|
| OTP brute force | Max 5 attempts → Redis lockout, 15-min OTP TTL |
| QR URL spoofing | HMAC-SHA256 signed QR payloads, validated server-side |
| Auth privilege escalation | Session type (`attendee/admin/staff`) enforced server-side; tRPC middleware role check |
| CSRF | SameSite=Strict cookies; all state-changing ops are POST/mutation only |
| Scan farming | Redis rate limit: 10 QR scans / attendee / minute |
| SQL injection | Prisma parameterized queries — no raw SQL in domain code |
| XSS | React default escaping + strict CSP header |
| Data exposure | Sponsor leads query includes `consent = true` filter at DB level — not just UI gating |
| Magic link reuse | Single-use invalidation via Redis key on first use |
| Secret management | All secrets in environment variables; zero secrets in codebase |

---

## 16. Accessibility & Internationalisation

- **WCAG 2.1 AA** target on all attendee-facing surfaces.
- Semantic HTML enforced via `eslint-plugin-jsx-a11y`.
- All user-facing strings in `messages/en.json` — `next-intl` for type-safe access.
- No multi-language UI in v1 — strings externalized so future localization = translation file only.

---

## 17. Full Dependency Manifest

### Production
```
next@14, react@18, react-dom@18
typescript@5
tailwindcss@3, framer-motion@11
zustand@4, @tanstack/react-query@5
@trpc/server@11, @trpc/client@11, @trpc/next@11
prisma@5, @prisma/client@5
iron-session@8, jose@5
resend@3, @react-email/components
@upstash/redis@1, @upstash/ratelimit@1
qrcode@1.5, @vercel/og@0.6, jszip@3
@aws-sdk/client-s3@3  (Cloudflare R2)
zod@3, pino@9, next-intl@3
posthog-js@1, @sentry/nextjs@8
```

### Development
```
vitest@1, @testing-library/react@15, @testing-library/user-event@14
playwright@1
eslint@8, eslint-config-next, eslint-plugin-jsx-a11y, prettier@3
```

---

## 18. Architecture Decision Records (ADRs)

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Framework | Next.js 14 App Router | Vite + Express | Full-stack, SSR, edge routing, single deployment unit |
| Database | PostgreSQL + Prisma | MongoDB | Relational integrity for prize data, transactions, row-level locking |
| Attendee auth | Custom OTP | NextAuth, Clerk | Passwordless per spec; need full OTP state machine control for prize eligibility |
| Admin auth | Custom magic link | Same as attendee | Simpler UX for operators; well-understood pattern |
| State | Zustand + React Query | Redux, SWR | Minimal bundle; RQ handles server state, Zustand for client-only |
| API layer | tRPC | REST manual, GraphQL | Full-stack type safety, no schema duplication, lighter than GraphQL |
| Caching | Upstash Redis | Vercel KV, Elasticache | Serverless-compatible HTTP API, co-located rate limiting library |
| Email | Resend | SendGrid | React Email templates, better deliverability, cleaner API |
| Storage | Cloudflare R2 | AWS S3, Vercel Blob | Zero egress cost, same CDN as edge deployment |
| Deployment | Railway | Vercel, Fly.io | Managed Postgres + Redis co-located, persistent workers, simple pricing |
| Testing | Vitest + Playwright | Jest, Cypress | Vitest faster + native ESM; Playwright more reliable on mobile viewports |
