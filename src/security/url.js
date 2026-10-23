const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function safeExternalUrl(value) {
  if (typeof value !== 'string') return null;

  const input = value.trim();
  if (!input || input.length > 2048) return null;

  try {
    const url = new URL(input);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isSafeExternalUrl(value) {
  return safeExternalUrl(value) !== null;
}
