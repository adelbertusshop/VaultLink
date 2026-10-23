# VaultLink 2.0 — Stage 1 Audit

**Baseline commit:** `669ad7f8ff00497d70c52a6aa4f8d2769927f06d`
**Audit scope:** repository, client code, public integrations visible from the repository
**Database:** not yet verified
**Production deployment:** not yet verified from this connector

## Current MVP

- Supabase Auth registration/login/session/logout.
- CRUD for `links`.
- Client-side filtering/search.
- Free plan limit of 10 links enforced in the client.
- Stripe checkout integration through an Edge Function.
- Waitlist + EmailJS + analytics.
- PWA/service worker.
- PL/EN/DE/IT/ES landing.

## Critical findings

1. Legacy link data is stored as plaintext. The application did not contain an actual AES/Web Crypto implementation at the audit baseline.
2. Previous marketing copy claimed local AES-256/E2E/zero-access properties that were not implemented.
3. Link rendering accepted dangerous URL schemes because HTML escaping does not validate the URL protocol.
4. Service worker used broad cache-first behavior, including application HTML, with no API/auth filtering.
5. Free-plan limits were enforced only in the client.
6. Security headers/CSP were absent from the repository configuration.
7. Supabase RLS, Edge Function authorization, schema, and existing data require direct backend verification before database migration.

## Foundation changes on `vaultlink-2.0-foundation`

- Added cryptographic architecture specification.
- Added threat model.
- Added isolated Web Crypto foundation, not yet wired into the legacy MVP.
- Added strict external URL validator.
- Replaced broad service-worker cache behavior with a static-asset-only allowlist and cache version bump.
- Added baseline security headers with CSP in report-only mode.

## Explicitly not completed

- No database migration.
- No RLS changes.
- No production deployment.
- No legacy plaintext migration.
- No recovery mechanism.
- No secure sharing.
- No claim that the product is currently zero-knowledge/E2E.

## Next gate

Before creating the encrypted database model, verify the correct VaultLink Supabase project, schema, RLS policies, Edge Functions, auth configuration, and production deployment. Only then approve the database design and migration plan.
