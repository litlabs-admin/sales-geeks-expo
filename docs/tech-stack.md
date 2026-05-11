# SalesGeek Expo Companion Platform - Production Tech Stack Baseline

## 1. Architecture Baseline
- Application model: monorepo, multi-event platform, event-scoped domain boundaries.
- Runtime: Next.js 15 (App Router) + TypeScript.
- Interaction model:
  - Attendee app: mobile-first web UI.
  - Admin/staff console: same codebase, role-gated surfaces.
- URL contract: `/{eventSlug}/...` for all attendee flows.
- API contract:
  - Public read/write APIs under `/api/v1`.
  - Server actions only for trusted authenticated browser mutations.
- Deployment:
  - Frontend + API routes: Vercel.
  - Database + storage + auth: Supabase.
  - Caching/ratelimit/ephemeral idempotency state: Upstash Redis.

## 2. Frontend Stack
- Framework: Next.js App Router with Server Components by default.
- UI primitives: Tailwind CSS + shadcn-style component layer.
- Form handling: React Hook Form + Zod resolvers.
- Client data sync: TanStack Query (queries + invalidations + retry policy).
- Local state: use React state first; use Zustand only for cross-page ephemeral app state.
- Charts/ops visualizations: lightweight chart library (Recharts) for admin dashboard metrics.
- Design system constraints:
  - Event theme tokens (color, spacing, typography) loaded per event.
  - WCAG 2.1 AA contrast requirements enforced by token set.

## 3. Backend and Domain Stack
- Language/runtime: TypeScript on Node.js (via Next.js runtime).
- Data access: Drizzle ORM.
- Schema migration: Drizzle SQL migrations committed in-repo.
- Core modules (explicit boundaries):
  - `identity`
  - `event-config`
  - `qr`
  - `scoring`
  - `leaderboard`
  - `rewards`
  - `sponsor`
  - `notifications`
  - `reporting`
  - `audit`
- Domain constraints:
  - Every mutable business record must include `event_id`.
  - Competition score and spendable balance are separate ledgers.
  - Reward inventory updates and redemption state must be transactionally atomic.

## 4. Data Layer
- Primary datastore: Supabase Postgres.
- Essential extensions/features:
  - `pgcrypto` for generated identifiers and signatures.
  - `pg_trgm` for fuzzy attendee search by name/email/business/alias.
- Storage: Supabase Storage buckets:
  - `event-branding`
  - `speaker-assets`
  - `venue-assets`
  - `qr-exports`
- Indexing strategy:
  - Composite indexes on `(event_id, status)` for high-frequency reads.
  - Ledger indexes on `(attendee_id, created_at)`.
  - Leaderboard projection indexes on `(event_id, score desc, reached_at asc)`.

## 5. Queueing, Scheduling, and Idempotency
- Queue model: DB-backed queue table + worker endpoint.
- Triggering:
  - Immediate enqueue from transactional writes for side effects.
  - Scheduled jobs via Vercel Cron.
- Redis usage:
  - Short-lived idempotency keys.
  - Per-endpoint rate-limit counters.
  - Deduplication locks for worker consumers.
- Idempotency contract:
  - Required for scan awards, reward redemption, reversal, and booking reconciliation paths.
  - Endpoint-level idempotency keys + domain-level uniqueness constraints.

## 6. AuthN/AuthZ and Security
- Attendee authentication:
  - Supabase Auth email OTP (passwordless).
  - Event-bound session context resolved server-side.
- Admin/staff authentication:
  - Supabase Auth magic link or OTP.
  - Role model: `admin`, `staff`.
- Authorization:
  - Server-side RBAC checks in every privileged mutation handler.
  - No UI-only authorization.
- Security controls:
  - Rate limits for auth, scan, redeem, notification send, and export endpoints.
  - Signed QR payloads with expiry + replay-safe award handling.
  - CSRF protection for browser-initiated state mutation.
  - Strict input validation via shared Zod schemas.
  - Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy).
  - Secrets in Vercel env + Supabase secrets only (never in repo).

## 7. Observability and Operations
- Error monitoring: Sentry (frontend + backend).
- Logging:
  - Structured JSON logs.
  - Correlation/request IDs on all API calls.
  - Actor attribution (`attendee_id` or `staff/admin_id`) on sensitive actions.
- Product telemetry: PostHog for funnel and event-day behavioral analytics.
- Uptime/synthetic monitoring: Better Stack or UptimeRobot checks.
- Audit log:
  - Mandatory for score adjustments, reversals, disqualifications, merges, inventory overrides, and consent-affecting changes.

## 8. Performance and Scale Targets
- Capacity baseline:
  - 5,000+ total attendees.
  - 500+ concurrent active users during event peaks.
- SLO targets:
  - p95 read latency < 300ms.
  - p95 scoring/redemption write latency < 700ms.
  - 99.9% correctness for repeated idempotent operations.
- Performance tactics:
  - Cache-friendly read routes for agenda/home blocks.
  - Leaderboard materialized/read model refresh strategy.
  - Aggressive payload slimming for mobile connectivity constraints.
  - Retry-safe client mutation patterns.

## 9. CI/CD and Quality Gates
- Package manager/build orchestration: pnpm + Turborepo.
- CI provider: GitHub Actions.
- Required checks per PR:
  - `typecheck`
  - `lint`
  - `unit`
  - `integration`
  - `contract`
  - `e2e-smoke`
  - `migration-safety`
- Environments:
  - Preview (per PR)
  - Staging (UAT)
  - Production
- Release policy:
  - Protected promotion from staging to production.
  - Change freeze enforced during live event peak windows.

## 10. Stable Public Types and Contracts
- URL/event scope: `eventSlug` path segment is required.
- Lifecycle enum: `pre_event | event_day | post_event_archive`.
- QR type enum: `entry | sponsor | session | hidden_bonus | staff_validated`.
- Role enum: `attendee | staff | admin`.
- Ledger tables:
  - `competition_score_ledger`
  - `spendable_balance_ledger`
- Consent model:
  - `terms_accepted` stored independently from `sponsor_consent`.
- Backward compatibility rule:
  - Public API response shape versioned and additive by default.
