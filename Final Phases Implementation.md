# Final Phase-Wise Implementation Plan

# Scottish Growth Expo 2026 — QR Networking & Event Management Platform

This document defines the complete implementation roadmap, system workflow, architecture responsibilities, and development phases for the Scottish Growth Expo 2026 platform.

The platform is designed as a:

# QR-Based Event Networking, Business Discovery & Lead Management System

The system prioritizes:

* simple event entry
* fast attendee onboarding
* business networking
* QR-based identity exchange
* centralized admin operations
* real-time event management

---

# Core User Roles

| Role     | Responsibility                          |
| -------- | --------------------------------------- |
| Admin    | Full platform access and event control  |
| Staff    | Event operations and QR management      |
| Business | Exhibitor/sponsor accounts              |
| Attendee | Event participants and networking users |

---

# Core System Philosophy

The platform intentionally avoids:

* gamified scoring systems
* multiple dynamic QR systems
* reward economies
* overly complex scan pipelines

Instead, the system focuses on:

* networking
* business discovery
* attendee management
* lead generation
* operational simplicity

---

# High-Level Workflow

---

# 1. Event Setup

Admin creates:

* event
* branding
* slug
* lifecycle state

Example:

```txt id="8vjlwm"
/sge2026
```

Admin also manages:

* staff accounts
* business onboarding
* event configuration

---

# 2. Business Registration

Businesses register into the platform.

Each business automatically receives:

* one permanent QR
* one profile page
* one networking endpoint

Businesses CANNOT:

* generate new QRs
* regenerate QRs
* create multiple QRs

Only Admins and Staff can manage QR operations.

---

# 3. Universal Event Entry QR

The event contains ONE main entry QR.

Example:

```txt id="mxj6md"
/sge2026/entry
```

This QR supports:

* preregistered attendees
* walk-in attendees

---

# 4. Attendee Entry Workflow

### If attendee already preregistered:

* scan QR
* session verified
* instantly enters app
* auto check-in occurs

---

### If attendee is new:

* scan same QR
* registration form opens
* attendee registers
* OTP verification occurs
* attendee enters app

---

# 5. Networking Workflow

Attendee scans a business QR.

The system:

* opens business profile
* creates connection record
* optionally captures attendee interest
* logs interaction

This becomes the core lead-generation engine.

---

# 6. Admin & Staff Operations

Admins and Staff can:

* manage attendees
* manage businesses
* manage QR access
* monitor analytics
* export leads
* track event activity

---

# 7. Archive Workflow

After the event:

* networking disables
* new scans disable
* analytics remain accessible
* exports remain available
* admin retains permanent access

---

# Recommended Tech Stack

| Layer            | Technology            |
| ---------------- | --------------------- |
| Frontend         | Next.js 14 App Router |
| Styling          | Tailwind CSS          |
| Backend API      | tRPC                  |
| Database         | PostgreSQL            |
| ORM              | Prisma                |
| Authentication   | iron-session          |
| Email            | Resend                |
| QR Generation    | qrcode                |
| Deployment       | Vercel                |
| State Management | Zustand               |
| File Storage     | UploadThing / S3      |
| Analytics Cache  | Redis (optional)      |

---

# Database Architecture

Every entity MUST contain:

```txt id="5c0a6n"
eventId
```

This ensures:

* multi-event support
* clean isolation
* future scalability

---

# Core Database Tables

| Table            | Purpose                  |
| ---------------- | ------------------------ |
| Event            | Event configuration      |
| Admin            | Admin accounts           |
| Staff            | Staff accounts           |
| Business         | Exhibitor data           |
| BusinessQR       | Permanent QR mapping     |
| Attendee         | Attendee profiles        |
| ConnectionRecord | Scan/networking history  |
| Notification     | Broadcast updates        |
| AuditLog         | System activity tracking |

---

# PHASE 1 — Platform Foundation & Role System

# Objective

Build the base application architecture, authentication system, and event structure.

---

# What to Implement

### Core Project Setup

* Next.js setup
* Tailwind setup
* Prisma setup
* PostgreSQL connection
* tRPC setup

---

### Authentication System

Build:

* Admin login
* Staff login
* session handling
* middleware protection

Recommended:

* `iron-session`
* JWT-backed sessions

---

### Event System

Build:

* Event creation
* Event branding
* Event slug routing
* Event lifecycle states:

  * `pre-event`
  * `event-day`
  * `archive`

---

### Role Permissions

| Role     | Permissions            |
| -------- | ---------------------- |
| Admin    | Full access            |
| Staff    | Operational tools only |
| Business | Own profile access     |
| Attendee | App usage only         |

---

# Workflow

Admin creates:

```txt id="hqb4n9"
Scottish Growth Expo 2026
```

System generates:

```txt id="mfmv9x"
/sge2026
```

All future routes bind to this event.

---

# Completion Criteria

* Admin login works
* Staff login works
* Role restrictions work
* Event creation works
* Branding updates dynamically
* Protected routes enforced

---

# 🚨 Non-Negotiables

* Role security MUST work correctly
* Sessions MUST be secure
* Every table MUST contain `eventId`
* Staff MUST NOT access Admin controls

---

# PHASE 2 — Attendee Registration & Universal Event Entry

# Objective

Build the attendee onboarding and entry experience using one universal QR.

---

# What to Implement

### Registration Form

Fields:

* Name
* Email
* Business
* Phone

---

### OTP Verification

Workflow:

1. generate OTP
2. email OTP
3. verify OTP
4. activate attendee

---

### Universal Entry QR

Generate one global QR:

```txt id="l6g9z7"
/sge2026/entry
```

---

# Workflow

## Existing Attendee

Scans QR:

* system finds account
* attendee enters instantly
* auto check-in occurs

---

## Walk-in Attendee

Scans same QR:

* registration form opens
* attendee registers
* verification occurs
* attendee enters app

---

# Auto Check-in

When event is in:

```txt id="9v9szy"
event-day
```

system automatically sets:

```txt id="0z9hmu"
checkedIn = true
```

---

# Completion Criteria

* Same QR supports both flows
* Registration works
* OTP works
* Duplicate emails prevented
* Check-in updates automatically

---

# 🚨 Non-Negotiables

* Event entry MUST remain simple
* Same QR MUST support both flows
* Email MUST remain immutable
* Registration MUST remain fast

---

# PHASE 3 — Business Onboarding & Permanent QR Generation

# Objective

Build the exhibitor/business system with automatic QR generation.

---

# What to Implement

### Business Registration

Fields:

* Company Name
* Representative
* Email
* Booth Number
* Category
* Description

---

### Automatic QR Generation

When business enters database:

1. create business record
2. generate business ID
3. generate permanent QR
4. store QR mapping

Example:

```txt id="lr34mo"
/sge2026/business/biz_10291
```

---

# Important QR Rules

Businesses:

* receive ONLY one QR
* CANNOT generate new QRs
* CANNOT regenerate QRs

Admins and Staff:

* CAN regenerate/reprint QRs if required

---

# Staff QR Operations

Staff dashboard includes:

* QR print page
* QR download
* QR regeneration
* booth QR management

---

# Workflow

Business gets onboarded →

QR automatically generated →

QR printed/displayed at booth →

Attendees scan QR during networking

---

# Completion Criteria

* Business registration works
* QR generates automatically
* QR correctly maps to business
* Staff can manage QR operations
* Business cannot create extra QRs

---

# 🚨 Non-Negotiables

* One business = one QR
* QR generation MUST be automatic
* Businesses MUST NOT control QR creation
* QR-business mapping MUST remain permanent

---

# PHASE 4 — Networking & Lead Exchange System

# Objective

Build the attendee-business interaction layer.

This becomes the core value proposition of the platform.

---

# What to Implement

### Business Profile Pages

QR opens:

* business details
* company description
* contact information
* social links
* booth location

---

### Connection Tracking

When attendee scans QR:

Create:

```txt id="k5cb8d"
ConnectionRecord {
  attendeeId,
  businessId,
  timestamp
}
```

---

### Interest System

Attendee can:

```txt id="dc7wzu"
I'm Interested
```

and optionally share details.

---

### Connection History

Attendees can later view:

* scanned businesses
* saved companies
* networking history

---

# Workflow

Attendee scans business QR →

Business profile opens →

Connection stored →

Lead captured →

Admin analytics update

---

# Completion Criteria

* Business profiles load correctly
* QR scans resolve correctly
* Connection records store successfully
* Duplicate scans prevented
* Interest capture works

---

# 🚨 Non-Negotiables

* QR scans MUST be reliable
* Consent handling MUST be explicit
* Networking flow MUST remain fast
* Connection records MUST be accurate

---

# PHASE 5 — Admin Dashboard & Staff Operations

# Objective

Build operational control systems for live event management.

---

# What to Implement

### Admin Dashboard

Admins can:

* manage attendees
* manage businesses
* view analytics
* export leads
* manage event state
* deactivate accounts

---

### Staff Dashboard

Staff can:

* assist attendee entry
* verify registrations
* manage QR printing
* help businesses
* monitor check-ins

---

### Analytics Dashboard

Track:

* total attendees
* check-ins
* business scans
* popular booths
* networking interactions

---

### Audit Logs

Track:

* who performed action
* affected entity
* timestamp
* operation details

---

# Workflow

Admins monitor live event →

Staff handle operations →

Analytics update in real time →

Audit logs preserve system history

---

# Completion Criteria

* Admin has full database visibility
* Staff operational tools work
* Analytics update correctly
* Audit logs capture actions
* QR management tools function

---

# 🚨 Non-Negotiables

* Admin MUST retain full visibility
* Staff MUST remain permission restricted
* Audit logs MUST be permanent
* QR management MUST remain staff-controlled

---

# PHASE 6 — Notifications, Exports & Archive System

# Objective

Build final operational systems and post-event lifecycle management.

---

# What to Implement

### Notification System

Admins send:

* announcements
* reminders
* event updates

Attendees receive:

* in-app notifications
* unread indicators

---

### Export System

Admins export:

* attendees
* businesses
* networking records
* consented leads

Preferred format:

```txt id="43xg9f"
CSV
```

---

### Archive Mode

When event enters:

```txt id="bm8ph2"
archive
```

system:

* disables new networking
* disables new scans
* locks registrations
* preserves analytics

---

### Access Expiry

After configured duration:

* attendee access closes
* admin access remains permanent

---

# Workflow

Event ends →

Admin archives event →

System becomes read-only →

Exports remain accessible →

Historical analytics preserved

---

# Completion Criteria

* Notifications deliver correctly
* Exports generate correctly
* Archive mode works
* Historical data preserved
* Admin retains permanent access

---

# 🚨 Non-Negotiables

* Exported leads MUST respect consent
* Archive mode MUST preserve data integrity
* Admin access MUST remain permanent
* Notifications MUST fail gracefully
