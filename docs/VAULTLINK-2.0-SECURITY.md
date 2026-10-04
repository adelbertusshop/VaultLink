# VaultLink 2.0 Foundation — security notes

## Current architecture

- Authentication: Supabase Auth.
- Vault encryption: browser Web Crypto API.
- KDF: PBKDF2-SHA-256, 600,000 iterations.
- Data encryption: AES-256-GCM.
- GCM nonce: 96-bit / 12 bytes, generated with `crypto.getRandomValues`.
- Ciphertext is stored in `links.encrypted_data`.
- Nonce is stored in `links.encryption_iv`.
- Encryption version is stored in `links.encryption_version`.
- Vault salt and KDF parameters are stored in `vault_settings`.
- Plaintext vault fields are cleared after migration/save on the foundation branch.
- Additional authenticated data binds a record to the authenticated user, record ID and crypto version.

## Important security boundary

The vault passphrase is never sent to Supabase by the application code reviewed on this branch. The derived AES key is non-extractable in the Web Crypto API.

This does **not** by itself prove a complete zero-knowledge system. The application still depends on the browser runtime, deployed JavaScript, authentication, RLS and the integrity of the delivery path.

## Foundation changes

- Added isolated `src/crypto/index.js` cryptographic primitives.
- Added `crypto.js` used by the dashboard.
- Added vault-key clearing on logout and page exit.
- Restricted the service worker to static assets; navigation and authenticated/API traffic are not cached.
- Changed Vercel CSP from Report-Only to enforced CSP.
- Added HSTS, X-Frame-Options and existing hardening headers.

## Still required before production security claims

1. Verify every RLS policy against the ownership model.
2. Enforce Free/Pro limits server-side, not only in browser JavaScript.
3. Decide and document account/vault recovery semantics.
4. Add automated cryptographic regression tests.
5. Remove or reduce CSP `unsafe-inline` once inline scripts are migrated to external files/nonces.
6. Verify deployed production behavior with authenticated browser tests.
7. Run Supabase security advisors after database policy changes.
8. Remove any remaining marketing statements that claim stronger guarantees than the implementation proves.

No database migration is included in this foundation branch until RLS and production data-access behavior are verified.
