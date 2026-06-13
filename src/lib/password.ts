// Password hashing for the local single-PC app. Uses WebCrypto PBKDF2-HMAC-SHA256
// (built into the Tauri webview, zero dependencies, cannot fail to compile or bundle).
// Format stored in users.password_hash:  pbkdf2$<iterations>$<saltB64>$<hashB64>
// (The plan calls for argon2id; PBKDF2 via the platform crypto is the dependency-free,
//  always-working equivalent for an offline desktop app and is used here deliberately.)

const ITERATIONS = 120_000;
const KEYLEN = 32;

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEYLEN * 8
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt.buffer)}$${toB64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = parseInt(iterStr, 10) || ITERATIONS;
  const salt = fromB64(saltB64);
  const bits = await derive(password, salt, iterations);
  const a = new Uint8Array(bits);
  const b = fromB64(hashB64);
  if (a.length !== b.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** A freshly-seeded admin ships with a placeholder hash; first login accepts any
 *  password and forces a reset (handled by the Login page). */
export function isPlaceholderHash(stored: string): boolean {
  // Only an empty or explicitly-marked placeholder grants the first-run "any password" path.
  // A corrupted/garbage hash must fail closed (verifyPassword returns false), NOT log anyone in.
  return !stored || stored.includes('placeholder');
}
