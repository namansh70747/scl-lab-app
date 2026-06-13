import { dbQuery, dbExecute } from "@/lib/db";

/**
 * Offline licensing for NamAsta Diagnostics.
 *
 * Activation keys are ECDSA-P256 signed by the vendor's PRIVATE key (tools/gen-license.mjs).
 * The app embeds only the PUBLIC key below, so it can VERIFY a key but can never forge one —
 * a customer can't make their own. A verified key encodes the lab name + plan + expiry; once
 * activated it's stored locally and re-verified on every launch, so an in-tenure lab is never
 * prompted again until it expires. In development the gate is fully bypassed.
 */

const PUBLIC_KEY_B64 =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1J2ca188F0Fo0fnp8na5TFub8zgKLUolIUeWmSbKnVh61mGK32UIgP1J8x7eO64Tkcrf++378ClBTz2QWlPW/w==";

export interface LicenseInfo {
  lab: string;
  plan: string;
  iat: number;
  exp: number; // unix seconds
}

export interface LicenseStatus {
  active: boolean;
  dev?: boolean;
  lab?: string;
  plan?: string;
  exp?: number;       // unix seconds
  daysLeft?: number;  // whole days remaining on an active licence
  expired?: boolean;
}

function bytesFromB64(s: string, urlSafe: boolean): Uint8Array {
  let t = s;
  if (urlSafe) t = t.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let _pub: CryptoKey | null = null;
async function publicKey(): Promise<CryptoKey> {
  if (_pub) return _pub;
  _pub = await crypto.subtle.importKey(
    "spki",
    bytesFromB64(PUBLIC_KEY_B64, false),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return _pub;
}

/** Verify a key's signature and decode it. Returns null if the key is invalid/tampered. */
export async function verifyLicenseKey(key: string): Promise<LicenseInfo | null> {
  try {
    const dot = key.indexOf(".");
    if (dot <= 0) return null;
    const payloadB64 = key.slice(0, dot);
    const sig = bytesFromB64(key.slice(dot + 1), true);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      await publicKey(),
      sig,
      new TextEncoder().encode(payloadB64)
    );
    if (!ok) return null;
    const info = JSON.parse(new TextDecoder().decode(bytesFromB64(payloadB64, true))) as LicenseInfo;
    if (!info?.lab || !info?.exp) return null;
    return info;
  } catch {
    return null;
  }
}

async function readSetting(k: string): Promise<string | null> {
  const rows = await dbQuery<{ value: string }>("SELECT value FROM settings WHERE key=?", [k]);
  return rows[0]?.value ?? null;
}

/** Activate with a key. Verifies + checks expiry, then stores it (ungated — no login yet). */
export async function activateLicense(key: string): Promise<LicenseInfo> {
  const info = await verifyLicenseKey(key.trim());
  if (!info) throw new Error("This activation key is not valid. Please re-check it (or contact NamAsta).");
  if (info.exp * 1000 < Date.now()) throw new Error("This activation key has already expired.");
  await dbExecute(
    `INSERT INTO settings(key,value,updated_at) VALUES('license_key',?,CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
    [key.trim()]
  );
  return info;
}

/** Current licence state. Development is never gated; the developer logs in freely. */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (import.meta.env.DEV) return { active: true, dev: true };
  try {
    const key = await readSetting("license_key");
    if (!key) return { active: false };
    const info = await verifyLicenseKey(key);
    if (!info) return { active: false };
    if (info.exp * 1000 < Date.now()) {
      return { active: false, expired: true, lab: info.lab, plan: info.plan, exp: info.exp };
    }
    const daysLeft = Math.ceil((info.exp * 1000 - Date.now()) / 86_400_000);
    return { active: true, lab: info.lab, plan: info.plan, exp: info.exp, daysLeft };
  } catch {
    // If the DB can't be read yet, fail closed (show activation) rather than crash.
    return { active: false };
  }
}
