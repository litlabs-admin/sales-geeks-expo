# Phase 4 Completion - Business Onboarding + QR Generation

Date completed: 12 May 2026

## What We Implemented

- Added Phase 4 SQL migration `supabase/sql/0005_phase4_business_qr.sql`.
- Created `businesses` and `qr_codes` tables with RLS enabled.
- Added DB-level uniqueness so a business can have exactly one business QR.
- Added server-side HMAC QR signing and verification in `@sgexpo/domain/qr`.
- Added QR print-card helper in `@sgexpo/domain/qr-print`.
- Added backend routes for:
  - `GET /admin/businesses`
  - `POST /admin/businesses`
  - `POST /admin/qr`
  - `GET /admin/qr/print`
  - `GET /scan/:code`
- Added simple admin pages for business onboarding and staff miscellaneous QR creation.
- Added Supabase storage bucket config for `assets` and `qr-cards`.
- Added Phase 4 seed and behavioral test scripts.
- Installed `jszip` for QR bulk print ZIP generation.

## Database Work

- Applied `supabase/sql/0005_phase4_business_qr.sql` to the configured Supabase database.
- Seeded 8 test businesses for `sge-2026`.
- Confirmed each seeded business received exactly one signed business QR.

## Tests Run

All checks passed:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm seed:businesses`
- `pnpm test:qr:unique`
- `pnpm test:qr:idempotent`
- `pnpm test:qr:staff`
- `pnpm test:qr:sig`
- `pnpm test:qr:print`

## Phase 4 Gate

- Exactly one QR per business is enforced by a DB unique index.
- Calling business QR assignment twice returns the existing QR.
- Staff cannot mint a business QR through the miscellaneous QR route.
- Tampered QR signatures are rejected by the verifier.
- Bulk print returns a ZIP with one PNG per active QR in the event.

## Notes

- Local backend tests used `http://localhost:8081` because port `8080` is occupied on this machine.
- The Phase 4 QR print PNG is a lightweight placeholder asset for now; the ZIP behavior and one-file-per-QR contract are in place for the later branded card rendering pass.
