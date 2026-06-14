import { dbQuery, dbExecute } from "@/lib/db";
import { invoke, isTauri } from "@/lib/tauri";

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
  dev?: string[]; // device fingerprints this key is locked to (max 2). Absent = any device.
}

export interface LicenseStatus {
  active: boolean;
  dev?: boolean;
  lab?: string;
  plan?: string;
  exp?: number;       // unix seconds
  daysLeft?: number;  // whole days remaining on an active licence
  expired?: boolean;
  deviceMismatch?: boolean;  // key is valid + in-tenure, but locked to other devices
  deviceId?: string;         // this PC's fingerprint (so the UI can show/send it)
}

/**
 * A short, stable fingerprint of THIS computer. Derived from the OS machine id (hashed, so the
 * raw id is never exposed) and used to lock an activation key to specific PCs — at most 2.
 * Cached for the session. In a plain browser (no Tauri) there's no machine id, so it's a
 * constant dev value (the licence gate is bypassed in dev anyway).
 */
let _fingerprint: string | null = null;
export async function getDeviceFingerprint(): Promise<string> {
  if (_fingerprint) return _fingerprint;
  let raw = "web-dev";
  try { if (isTauri()) raw = await invoke<string>("device_id"); } catch { /* fall back */ }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  _fingerprint = hex.slice(0, 12).toUpperCase();   // 12 readable hex chars, e.g. "A3F90C12B4D7"
  return _fingerprint;
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
    // Normalise the device-lock list (tolerate a key minted without it = unbound).
    info.dev = Array.isArray(info.dev) ? info.dev.filter(d => typeof d === "string") : undefined;
    return info;
  } catch {
    return null;
  }
}

async function readSetting(k: string): Promise<string | null> {
  const rows = await dbQuery<{ value: string }>("SELECT value FROM settings WHERE key=?", [k]);
  return rows[0]?.value ?? null;
}

/**
 * A monotonic "now" that can't be pushed backwards. We persist the highest timestamp ever
 * seen; if the PC clock is later wound back (to dodge an expiry) we keep using the high-water
 * mark, so an expired licence stays expired. Returns milliseconds.
 */
async function effectiveNow(): Promise<number> {
  const now = Date.now();
  const stored = parseInt((await readSetting("time_hwm")) ?? "0", 10) || 0;
  const eff = Math.max(now, stored);
  // Only persist when the mark moves forward by ≥1h. The gate re-checks every minute and the
  // clock always advances, so writing every call would hammer the DB with a write a minute,
  // forever. Hour granularity keeps rollback protection while cutting the write churn ~60×.
  if (eff - stored >= 3_600_000) {
    await dbExecute(
      `INSERT INTO settings(key,value,updated_at) VALUES('time_hwm',?,CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
      [String(eff)]
    ).catch(() => {});
  }
  return eff;
}

/** Activate with a key. Verifies + checks expiry, then stores it (ungated — no login yet). */
export async function activateLicense(key: string): Promise<LicenseInfo> {
  // Strip ALL whitespace — keys pasted from WhatsApp/email often pick up spaces or line wraps.
  const cleaned = key.replace(/\s+/g, "");
  const info = await verifyLicenseKey(cleaned);
  if (!info) throw new Error("This activation key is not valid. Please re-check it (or contact NamAsta).");
  if (info.exp * 1000 < await effectiveNow()) throw new Error("This activation key has already expired.");
  // Device lock: a key bound to specific PCs (max 2) only activates on one of them. The list is
  // inside the signature, so it can't be edited — a 3rd computer simply cannot use this key.
  if (info.dev && info.dev.length) {
    const fp = await getDeviceFingerprint();
    if (!info.dev.includes(fp)) {
      throw new Error(
        `This key is registered to other device(s). This PC's Device ID is ${fp} — send it to NamAsta to add this computer (each key allows up to 2).`
      );
    }
  }
  await dbExecute(
    `INSERT INTO settings(key,value,updated_at) VALUES('license_key',?,CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
    [cleaned]
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
    const now = await effectiveNow();
    if (info.exp * 1000 < now) {
      return { active: false, expired: true, lab: info.lab, plan: info.plan, exp: info.exp };
    }
    // Device lock re-checked on every launch: a stored key that's bound to other PCs must NOT
    // unlock this one (e.g. the scl.db was copied to a third computer). Fail to the activation
    // screen with this PC's id so it can be registered.
    if (info.dev && info.dev.length) {
      const fp = await getDeviceFingerprint();
      if (!info.dev.includes(fp)) {
        return { active: false, deviceMismatch: true, deviceId: fp, lab: info.lab, plan: info.plan, exp: info.exp };
      }
    }
    const daysLeft = Math.ceil((info.exp * 1000 - now) / 86_400_000);
    return { active: true, lab: info.lab, plan: info.plan, exp: info.exp, daysLeft };
  } catch {
    // If the DB can't be read yet, fail closed (show activation) rather than crash.
    return { active: false };
  }
}
