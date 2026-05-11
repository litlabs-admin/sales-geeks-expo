# deployment_and_production.md

# SalesGeek Scotland Event Companion Platform
# Deployment & Production Infrastructure Guide

---

# 1. Purpose of This Document

This document defines:

- production deployment architecture
- infrastructure setup
- hosting strategy
- CI/CD workflow
- environment management
- monitoring systems
- production security
- event-day operational deployment rules

This document exists separately from the implementation plan because:

- implementation explains HOW to build the platform
- deployment explains HOW to run the platform safely in production

This is the authoritative production infrastructure guide for the SalesGeek Scotland Event Companion Platform.

---

# 2. Production Infrastructure Philosophy

The platform is designed for:

- premium event operations
- 350–500 executive attendees
- real-time QR interactions
- live event-day reliability
- fast operational deployment
- maintainable infrastructure

The architecture intentionally avoids:

- Kubernetes complexity
- self-hosted infrastructure
- manual server maintenance
- heavy DevOps overhead

The platform uses:

- managed cloud infrastructure
- serverless deployment
- managed database services
- managed caching infrastructure

This allows the engineering team to focus on:

- product quality
- QR reliability
- operational stability
- attendee experience

instead of server management.

---

# 3. Final Production Architecture

The final production stack is:

```txt
Users
   ↓
Vercel (Next.js App + API)
   ↓
--------------------------------
↓              ↓             ↓
Neon        Upstash       Resend
(Postgres)  (Redis)       (Email)
--------------------------------
↓
UploadThing / S3
(File Storage)
--------------------------------
↓
Sentry + PostHog
(Monitoring & Analytics)
```

---

# 4. Infrastructure Providers

| Layer | Provider | Purpose |
|---|---|---|
| Frontend + API | Vercel | Application hosting |
| Database | Neon | PostgreSQL database |
| Redis | Upstash | OTPs, caching, idempotency |
| Email | Resend | OTP and transactional emails |
| File Storage | UploadThing / AWS S3 | Asset storage |
| DNS & SSL | Cloudflare | Domain management |
| Monitoring | Sentry | Error tracking |
| Analytics | PostHog | Product analytics |
| Source Control | GitHub | Code repository |
| CI/CD | GitHub Actions | Automated testing and deployment |

---

# 5. Why Vercel?

The platform is built using:

- Next.js 14
- App Router
- server-side rendering
- middleware
- route handlers
- server actions

Vercel is optimized specifically for this architecture.

---

# What Runs on Vercel?

Vercel hosts:

- frontend UI
- App Router pages
- tRPC APIs
- middleware
- authentication flows
- route handlers
- server actions
- edge functions

---

# Vercel Benefits

| Feature | Benefit |
|---|---|
| Automatic HTTPS | Secure production deployment |
| Preview Deployments | Safe testing before release |
| GitHub Integration | Automatic deployments |
| Environment Variables | Secure configuration |
| Global CDN | Fast performance |
| Serverless Scaling | Event-day reliability |

---

# Production Domain

Primary production URL:

```txt
https://app.salesgeek.scot
```

---

# 6. PostgreSQL Database Deployment

The production database uses:

```txt
Neon PostgreSQL
```

---

# Why Neon?

Neon provides:

- managed PostgreSQL
- automatic backups
- production-grade reliability
- connection pooling
- scalable architecture
- serverless compatibility

---

# What Is Stored in PostgreSQL?

The database stores:

- attendees
- businesses
- sponsors
- scans
- leaderboard data
- reward inventory
- notifications
- audit logs
- networking records
- event configurations
- QR mappings

This is the source of truth for the platform.

---

# Database Requirements

## Mandatory Requirements

- automatic backups enabled
- SSL connections enforced
- Prisma migrations version controlled
- production rollback strategy defined
- connection pooling enabled

---

# Database Backup Strategy

Production database must support:

| Feature | Requirement |
|---|---|
| Daily backups | Mandatory |
| Point-in-time recovery | Recommended |
| Rollback capability | Mandatory |
| Migration history | Mandatory |

---

# Database Environment Variables

Example:

```env
DATABASE_URL=
DIRECT_URL=
```

---

# 7. Redis Infrastructure

The platform uses:

```txt
Upstash Redis
```

Redis is REQUIRED.

---

# What Redis Handles

Redis is responsible for:

- OTP storage
- scan idempotency
- leaderboard caching
- rate limiting
- temporary locks
- duplicate scan protection
- retry safety
- live counters

---

# Why Redis Is Critical

Without Redis:

- duplicate QR scans become possible
- leaderboard queries become expensive
- OTP handling becomes unreliable
- retry safety breaks
- scan race conditions increase

Redis is NOT optional.

---

# Redis Environment Variables

Example:

```env
REDIS_URL=
REDIS_TOKEN=
```

---

# 8. Email Infrastructure

The platform uses:

```txt
Resend
```

for:

- OTP emails
- booking confirmations
- transactional notifications
- operational emails

---

# Email Reliability Requirements

Because onboarding depends on OTP delivery,
email infrastructure is mission-critical.

---

# Mandatory DNS Records

The following must be configured:

| Record | Purpose |
|---|---|
| SPF | Sender verification |
| DKIM | Email signing |
| DMARC | Anti-spoofing protection |

Without these:

- OTP emails may fail
- spam filtering increases
- attendee onboarding reliability drops

---

# Recommended Email Domain

Example:

```txt
mail.salesgeek.scot
```

---

# Email Environment Variables

Example:

```env
RESEND_API_KEY=
EMAIL_FROM=
```

---

# 9. File Storage Infrastructure

The platform requires file storage for:

- sponsor logos
- event branding
- speaker photos
- geek profile photos
- downloadable QR images

---

# Recommended Solution

For v1:

```txt
UploadThing
```

is recommended because:

- simple setup
- Next.js integration
- low operational complexity

Alternative:

```txt
AWS S3
```

for long-term scaling.

---

# 10. Domain & DNS Infrastructure

The platform uses:

```txt
Cloudflare
```

for:

- DNS management
- SSL certificates
- DDoS protection
- domain routing
- caching

---

# Recommended Domains

| Purpose | Example |
|---|---|
| Production | app.salesgeek.scot |
| Staging | staging.salesgeek.scot |
| Email | mail.salesgeek.scot |

---

# SSL Requirements

Mandatory:

- HTTPS only
- SSL certificates enabled
- secure cookies enforced

---

# 11. Environment Architecture

The platform requires THREE environments.

| Environment | Purpose |
|---|---|
| local | Development |
| staging | Pre-production testing |
| production | Live event deployment |

---

# Local Environment

Used for:

- feature development
- debugging
- local testing

Runs:

- local Next.js app
- local PostgreSQL OR remote dev DB
- local Redis OR shared dev Redis

---

# Staging Environment

Used for:

- pre-event testing
- QR validation
- operational simulation
- sponsor validation
- reward testing

Mandatory before production launch.

---

# Production Environment

Used ONLY for:

- live event deployment
- real attendee interactions
- sponsor operations
- production analytics

Production must remain stable and locked.

---

# 12. Environment Variables

Environment variables MUST remain separate across:

- local
- staging
- production

---

# Required Environment Variables

```env
DATABASE_URL=
DIRECT_URL=
REDIS_URL=
REDIS_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=
SESSION_SECRET=
QR_SIGNING_SECRET=
POSTHOG_KEY=
SENTRY_DSN=
```

---

# Security Rules

Environment variables:

- MUST NEVER be committed to GitHub
- MUST remain encrypted
- MUST remain environment-specific

---

# 13. GitHub Repository Structure

All code is stored on:

```txt
GitHub
```

---

# Recommended Branch Structure

| Branch | Purpose |
|---|---|
| main | Production |
| staging | Pre-production testing |
| dev | Development |

---

# Branch Responsibilities

## dev

- active feature development
- unstable changes allowed

## staging

- QA testing
- sponsor review
- operational simulation

## main

- production-safe only
- stable releases only

---

# 14. CI/CD Pipeline

The platform uses:

```txt
GitHub Actions + Vercel
```

for automated deployment.

---

# Deployment Flow

```txt
Developer Pushes Code
        ↓
GitHub Actions Run
        ↓
Linting
        ↓
Type Checking
        ↓
Testing
        ↓
Build Validation
        ↓
Vercel Deployment
```

---

# Mandatory CI Checks

Every deployment must:

- pass linting
- pass TypeScript validation
- pass tests
- validate Prisma schema
- complete successful production build

---

# Production Deployment Rules

Production deployments:

- MUST originate from main branch only
- MUST pass all checks
- MUST be rollback-safe

---

# 15. Monitoring & Error Tracking

The platform uses:

```txt
Sentry
```

for production monitoring.

---

# What Sentry Tracks

- API failures
- QR scan failures
- frontend crashes
- authentication failures
- reward transaction errors
- unexpected exceptions

---

# Why Monitoring Is Critical

Without monitoring:

- production issues become invisible
- QR failures go unnoticed
- attendee onboarding problems are missed

Monitoring is mandatory.

---

# Sentry Environment Variables

```env
SENTRY_DSN=
```

---

# 16. Product Analytics

The platform uses:

```txt
PostHog
```

for analytics.

---

# What PostHog Tracks

- onboarding completion
- QR engagement
- reward redemption
- sponsor interactions
- attendee activity
- feature usage

---

# Analytics Philosophy

Analytics should support:

- sponsor reporting
- event improvement
- engagement analysis
- operational insights

Analytics should NOT feel invasive.

---

# 17. Production Security Requirements

Mandatory security requirements:

- HTTPS only
- secure cookies
- signed QR URLs
- Redis rate limiting
- OTP brute-force protection
- environment isolation
- audit logging
- role-based access control

---

# QR Security

All QR URLs MUST:

- use signed URLs
- validate signatures server-side
- reject invalid signatures
- reject expired scans

Example:

```txt
/scan/[code]?sig=[hmac]
```

---

# Session Security

Sessions must:

- use HTTP-only cookies
- use secure cookies in production
- expire correctly
- remain role-scoped

---

# 18. Load Testing Requirements

Before production launch:

mandatory stress testing must occur.

---

# Critical Test Areas

Must test:

- concurrent QR scans
- duplicate scan retries
- leaderboard load
- reward redemption race conditions
- OTP bursts
- weak internet conditions

---

# Minimum Recommended Load Test

```txt
100+ concurrent scans
```

especially during:

- session exits
- keynote openings
- reward announcements

---

# 19. Event-Day Operational Rules

Because the platform supports a live event,
production operational rules are critical.

---

# 48-Hour Production Freeze

48 hours before event:

- no major feature additions
- no schema redesigns
- no risky deployments
- production backup snapshot created
- QR systems verified
- OTP systems verified

---

# Event-Day Deployment Rules

During live event:

- emergency fixes only
- no experimental releases
- no dependency upgrades
- no schema-breaking migrations

---

# Recommended Event-Day Team

| Role | Responsibility |
|---|---|
| Technical Lead | Production oversight |
| Ops Engineer | Deployment and monitoring |
| Staff Lead | Operational escalation |
| Admin Lead | Event coordination |

---

# 20. Backup & Recovery Strategy

Production systems must support:

- database rollback
- export recovery
- deployment rollback
- QR integrity verification

---

# Recommended Backup Rules

| Backup Type | Frequency |
|---|---|
| Database Snapshot | Daily |
| Export Snapshots | Post-event |
| Deployment Rollback | Every release |

---

# 21. Production Readiness Checklist

Before live deployment:

## Infrastructure

- Vercel configured
- Neon configured
- Redis configured
- Resend configured
- Cloudflare configured

---

## Security

- HTTPS enabled
- SPF configured
- DKIM configured
- DMARC configured
- environment variables secured

---

## Platform

- QR systems tested
- onboarding tested
- rewards tested
- leaderboard tested
- archive flow tested

---

## Operations

- staging validated
- backups enabled
- rollback verified
- monitoring enabled
- alerts configured

---

# 22. Final Deployment Philosophy

The platform prioritizes:

- reliability over infrastructure complexity
- operational simplicity over custom hosting
- managed cloud infrastructure over self-hosting
- production stability over experimental scaling

The deployment architecture is intentionally optimized for:

- premium live event execution
- rapid operational support
- scalable event infrastructure
- maintainable long-term growth

---

# 23. Final Outcome

At completion, the platform deployment architecture provides:

- secure production hosting
- scalable event infrastructure
- reliable QR operations
- stable attendee onboarding
- production-grade monitoring
- safe operational workflows
- reusable multi-event infrastructure

The system becomes:

- production-ready
- deployment-safe
- operationally scalable
- event-day reliable
- maintainable for future SalesGeek Scotland events

---

# End of deployment_and_production.md

