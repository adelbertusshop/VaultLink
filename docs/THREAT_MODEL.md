# VaultLink 2.0 — Threat Model

**Status:** Working security model
**Version:** 0.1

## Assets

- vault plaintext,
- passwords and secrets,
- API keys and tokens,
- recovery material,
- Vault Key and derived key material,
- account sessions,
- sharing keys,
- metadata that can reveal user activity.

## Adversaries

1. Database attacker with a stolen Supabase dump.
2. Authenticated attacker with access to another account's API surface.
3. XSS attacker executing JavaScript in the application origin.
4. Malicious or compromised third-party script/CDN.
5. Stolen device or browser profile.
6. Compromised GitHub/Vercel deployment path.
7. Abuse of public endpoints such as waitlist or checkout.
8. Operator/database administrator who can read stored database contents.

## Security objectives

- Plaintext vault contents should not be stored in the database.
- Account authentication must remain separate from vault unlock.
- Database compromise should not reveal vault plaintext.
- Tampered ciphertext must fail authentication.
- Key material must not be sent to analytics, URLs, logs, or third-party scripts.
- RLS must prevent cross-account access to metadata and ciphertext.
- Public endpoints must enforce server-side authorization and limits.

## Important web-platform limitation

Client-side encryption cannot protect an already-unlocked vault from arbitrary JavaScript executing in the trusted application origin. Therefore XSS, dependency integrity, deployment integrity, CSP, and third-party script minimization are part of the vault security boundary.

## Current MVP risks

The legacy MVP currently uses plaintext link data and must not be marketed as a zero-knowledge or end-to-end encrypted vault until the new architecture is implemented and verified.

Known priority areas:

- URL/XSS validation,
- service-worker cache scope,
- CSP and dependency pinning,
- server-side plan/limit enforcement,
- Supabase RLS verification,
- Edge Function authorization,
- MFA and recovery design,
- migration away from plaintext records.

## Security priorities

### P0

- Prevent XSS.
- Remove false security claims.
- Verify RLS and backend authorization.
- Prevent sensitive responses from being cached.

### P1

- Implement reviewed cryptographic foundation.
- Separate account session from vault unlock.
- Add MFA/session controls.
- Add server-side limits.

### P2

- Secure sharing.
- Recovery/emergency access.
- Device management.
- Advanced audit events.

## Non-goals for the first foundation

- custom cryptography,
- blockchain or token-based security claims,
- destructive database migrations,
- automatic recovery that gives the operator vault access,
- claiming compliance certifications that have not been independently obtained.
