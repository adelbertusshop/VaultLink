// VaultLink client-side cryptography foundation.
// Plaintext vault content never needs to be sent to Supabase.
const VAULT_CRYPTO_VERSION = 1;
const VAULT_KDF_ITERATIONS = 600000;
const VAULT_MIN_PASSPHRASE_LENGTH = 12;

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBase64(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64(bytes);
}

async function deriveVaultKey(passphrase, saltBase64, iterations = VAULT_KDF_ITERATIONS) {
  if (!passphrase || passphrase.length < VAULT_MIN_PASSPHRASE_LENGTH) {
    throw new Error('Hasło sejfu musi mieć co najmniej 12 znaków.');
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64),
      iterations,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVaultItem(key, item, userId, recordId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`${userId}:${recordId}:vaultlink:${VAULT_CRYPTO_VERSION}`);
  const plaintext = new TextEncoder().encode(JSON.stringify(item));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    key,
    plaintext
  );
  return {
    encrypted_data: bytesToBase64(new Uint8Array(ciphertext)),
    encryption_iv: bytesToBase64(iv),
    encryption_version: VAULT_CRYPTO_VERSION
  };
}

async function decryptVaultItem(key, row, userId) {
  if (!row.encrypted_data || !row.encryption_iv) throw new Error('Brak danych szyfrowania.');
  const version = row.encryption_version || VAULT_CRYPTO_VERSION;
  if (version !== VAULT_CRYPTO_VERSION) throw new Error('Nieobsługiwana wersja szyfrowania.');
  const aad = new TextEncoder().encode(`${userId}:${row.id}:vaultlink:${version}`);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(row.encryption_iv), additionalData: aad, tagLength: 128 },
    key,
    base64ToBytes(row.encrypted_data)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function validateVaultUrl(value) {
  if (typeof value !== 'string') throw new Error('Nieprawidłowy adres URL.');
  const input = value.trim();
  if (!input || input.length > 2048) throw new Error('Adres URL jest nieprawidłowy lub za długi.');
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Podaj prawidłowy adres URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Dozwolone są tylko adresy http:// i https://.');
  }
  return parsed.href;
}
