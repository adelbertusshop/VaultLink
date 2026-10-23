/*
 * VaultLink 2.0 cryptographic foundation.
 *
 * This module is intentionally isolated and NOT wired into the legacy MVP yet.
 * Do not market the application as zero-knowledge/E2E until the complete
 * architecture, migration, RLS, recovery model and security review pass.
 */

export const CRYPTO_VERSION = 1;
export const AES_KEY_BITS = 256;
export const IV_BYTES = 12; // 96-bit GCM nonce
export const SALT_BYTES = 16;

const te = new TextEncoder();
const td = new TextDecoder();

function assertCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable');
  }
}

export function randomBytes(length) {
  assertCrypto();
  if (!Number.isInteger(length) || length <= 0) {
    throw new TypeError('length must be a positive integer');
  }
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new TypeError('Invalid base64url value');
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

/**
 * Compatibility KDF only. Production parameter selection and Argon2id support
 * are deliberately blocked at the architecture layer until reviewed.
 */
export async function deriveKekPbkdf2(secret, salt, iterations = 600_000) {
  assertCrypto();
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new TypeError('secret must be a non-empty string');
  }
  if (!(salt instanceof Uint8Array) || salt.length < SALT_BYTES) {
    throw new TypeError('salt must be at least 16 bytes');
  }
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) {
    throw new RangeError('unsafe PBKDF2 iteration count');
  }

  const material = await crypto.subtle.importKey(
    'raw',
    te.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export function generateVaultKey() {
  assertCrypto();
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(key, plaintext, additionalData) {
  assertCrypto();
  if (!(plaintext instanceof Uint8Array)) throw new TypeError('plaintext must be Uint8Array');
  const iv = randomBytes(IV_BYTES);
  const params = { name: 'AES-GCM', iv };
  if (additionalData instanceof Uint8Array) params.additionalData = additionalData;
  const ciphertext = await crypto.subtle.encrypt(params, key, plaintext);
  return {
    version: CRYPTO_VERSION,
    algorithm: 'AES-256-GCM',
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptBytes(key, envelope, additionalData) {
  assertCrypto();
  if (!envelope || envelope.version !== CRYPTO_VERSION || envelope.algorithm !== 'AES-256-GCM') {
    throw new Error('Unsupported or invalid ciphertext envelope');
  }
  const iv = fromBase64Url(envelope.iv);
  if (iv.length !== IV_BYTES) throw new Error('Invalid GCM IV length');
  const ciphertext = fromBase64Url(envelope.ciphertext);
  const params = { name: 'AES-GCM', iv };
  if (additionalData instanceof Uint8Array) params.additionalData = additionalData;
  const plaintext = await crypto.subtle.decrypt(params, key, ciphertext);
  return new Uint8Array(plaintext);
}

export async function encryptString(key, plaintext, additionalData) {
  if (typeof plaintext !== 'string') throw new TypeError('plaintext must be a string');
  const envelope = await encryptBytes(key, te.encode(plaintext), additionalData);
  return envelope;
}

export async function decryptString(key, envelope, additionalData) {
  const plaintext = await decryptBytes(key, envelope, additionalData);
  return td.decode(plaintext);
}

export async function wrapVaultKey(kek, vaultKey, additionalData) {
  assertCrypto();
  const iv = randomBytes(IV_BYTES);
  const params = { name: 'AES-GCM', iv };
  if (additionalData instanceof Uint8Array) params.additionalData = additionalData;
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, kek, params);
  return {
    version: CRYPTO_VERSION,
    algorithm: 'AES-256-GCM-WRAP',
    iv: toBase64Url(iv),
    wrappedKey: toBase64Url(new Uint8Array(wrapped)),
  };
}

export async function unwrapVaultKey(kek, envelope, additionalData) {
  assertCrypto();
  if (!envelope || envelope.version !== CRYPTO_VERSION || envelope.algorithm !== 'AES-256-GCM-WRAP') {
    throw new Error('Unsupported or invalid wrapped-key envelope');
  }
  const iv = fromBase64Url(envelope.iv);
  const wrapped = fromBase64Url(envelope.wrappedKey);
  if (iv.length !== IV_BYTES) throw new Error('Invalid wrapped-key IV length');
  const params = { name: 'AES-GCM', iv };
  if (additionalData instanceof Uint8Array) params.additionalData = additionalData;
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    kek,
    params,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}
