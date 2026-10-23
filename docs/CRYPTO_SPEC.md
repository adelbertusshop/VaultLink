# VaultLink 2.0 — Cryptographic Specification

**Status:** Architecture draft — not yet production crypto
**Version:** 0.1
**Scope:** client-side vault encryption and key hierarchy

## 1. Security goal

VaultLink 2.0 is designed so that vault contents are encrypted before they leave the user's device. Supabase stores ciphertext and technical metadata, not plaintext vault contents.

This document is a design specification. Until the implementation and independent security review pass the release gates, VaultLink must not claim zero-knowledge, end-to-end encryption, or equivalent guarantees.

## 2. Trust boundaries

- Supabase Auth authenticates the account.
- Vault unlock is a separate capability.
- The application derives/unlocks key material locally.
- The database is treated as untrusted storage for vault ciphertext.
- Analytics, logs, URLs, and error reporting must never receive plaintext secrets or key material.

## 3. Key hierarchy

```text
User Vault Unlock Secret
        |
        v
       KDF
        |
        v
Key Encryption Key (KEK)
        |
        v
Wrapped Vault Key (stored with vault metadata)
        |
        v
Vault Key (plaintext only in protected runtime memory)
        |
        v
AES-256-GCM per-item encryption
```

The Vault Key is randomly generated and is not derived directly from the user's password.

## 4. Encryption primitive

Target primitive: **AES-256-GCM**.

Requirements:

- 256-bit key.
- 96-bit random IV/nonce for every encryption operation.
- Never reuse an IV with the same key.
- Authentication tag must be verified before plaintext is released to application code.
- Additional authenticated data (AAD) should bind ciphertext to immutable metadata such as vault/item identifiers and crypto version where appropriate.
- Ciphertext must include enough versioned metadata to select the correct decryptor.

No custom cryptographic algorithm is permitted.

## 5. KDF

Preferred KDF: **Argon2id**, subject to a reviewed browser-compatible implementation and explicit parameter selection.

Web Crypto does not provide Argon2id natively. PBKDF2-SHA-256 may be used only as a compatibility fallback when a reviewed Argon2id implementation cannot be shipped safely.

KDF parameters are intentionally **TBD** until benchmarking on supported devices and threat-model review are complete.

Salt must be unique per vault/key-encryption context and stored as non-secret metadata.

## 6. Vault unlock

Account authentication and vault unlock are separate states.

Logging into Supabase must not automatically expose the Vault Key.

A successful unlock should establish a bounded in-memory unlock session with:

- explicit lock operation,
- inactivity timeout,
- maximum lifetime,
- visibility/page lifecycle handling,
- panic lock path.

Do not persist raw Vault Keys in localStorage, sessionStorage, URL parameters, IndexedDB, analytics payloads, or ordinary application logs.

## 7. Ciphertext envelope

Target logical envelope:

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "kdf": "argon2id",
  "iv": "base64url",
  "ciphertext": "base64url",
  "aad": "base64url"
}
```

The exact database representation is intentionally deferred until the database audit is complete.

## 8. Recovery decision

Recovery is a security architecture decision, not a password-reset feature.

Possible models must be evaluated before implementation:

1. user-held recovery key,
2. encrypted recovery package,
3. trusted-device recovery,
4. trusted-contact/emergency recovery,
5. deliberate no-recovery mode.

Any recovery path that can decrypt the vault changes the threat model and must be documented explicitly.

## 9. Sharing

Secure sharing must never expose the Vault Key directly to the sharing service.

The future design should use a separately scoped sharing key and an encrypted, expiring payload with revocation metadata. Sharing is out of scope for the first crypto implementation.

## 10. Migration from the current MVP

The current MVP stores link data as plaintext. Migration must be client-side because the server must not receive the user's Vault Unlock Secret or plaintext-to-ciphertext conversion keys.

Migration will be additive:

1. create the new encrypted model,
2. implement crypto and unlock,
3. migrate records while the authenticated client can still read the legacy record,
4. verify ciphertext integrity,
5. only then retire legacy plaintext storage.

No destructive migration is permitted before this sequence is validated.

## 11. Release gates

The cryptographic layer cannot be called production-ready until:

- unit/integration tests cover round-trip encryption/decryption,
- tamper detection is tested,
- IV uniqueness is tested,
- wrong-key failure is tested,
- AAD mismatch fails closed,
- key material is not persisted by the application,
- migration behavior is tested,
- recovery behavior is explicitly approved,
- security headers and XSS protections are active,
- database RLS has been independently reviewed,
- production claims match the implemented guarantees.
