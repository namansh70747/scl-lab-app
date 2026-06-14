#!/usr/bin/env node
/**
 * NamAsta Diagnostics — activation-key generator (vendor-only).
 *
 * Signs a license with your PRIVATE key (tools/license-key.secret, never shipped).
 * The app embeds only the matching PUBLIC key and can VERIFY keys but never mint them —
 * so a customer cannot forge their own.
 *
 * Usage:
 *   node tools/gen-license.mjs "Lab Name" yearly
 *   node tools/gen-license.mjs "City Diagnostics" monthly
 *   node tools/gen-license.mjs "Sharma Clinical Laboratory" lifetime
 *   node tools/gen-license.mjs "Some Lab" 90        (custom: 90 days)
 *
 * Device-locking (recommended for PAID keys — max 2 PCs per key):
 *   node tools/gen-license.mjs "City Diagnostics" yearly A3F90C12B4D7
 *   node tools/gen-license.mjs "City Diagnostics" yearly A3F90C12B4D7 9B2E71FA0C44
 * The lab reads its "Device ID" off the activation screen and sends it with payment.
 * Omit device ids for an UNLOCKED key (works on any PC — use only for your OWN keys).
 *
 * Give the printed "Activation key" to the lab after they pay; they paste it in the app.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_DAYS = { monthly: 31, yearly: 366, triennial: 1096, lifetime: 36500 };

const lab = process.argv[2];
const planArg = (process.argv[3] || "yearly").toLowerCase();
if (!lab) {
  console.error('Usage: node tools/gen-license.mjs "Lab Name" [monthly|yearly|triennial|lifetime|<days>]');
  process.exit(1);
}
const days = PLAN_DAYS[planArg] ?? parseInt(planArg, 10);
if (!Number.isFinite(days) || days <= 0) { console.error("Invalid plan/days: " + planArg); process.exit(1); }

const privB64 = fs.readFileSync(path.join(__dirname, "license-key.secret"), "utf8").trim();
const privateKey = crypto.createPrivateKey({ key: Buffer.from(privB64, "base64"), format: "der", type: "pkcs8" });

// Any args after the plan are device fingerprints to lock the key to (max 2).
const devices = process.argv.slice(4).map(s => s.trim().toUpperCase()).filter(Boolean);
if (devices.length > 2) { console.error("A key can be locked to at most 2 devices."); process.exit(1); }

const now = Math.floor(Date.now() / 1000);
const exp = now + days * 24 * 60 * 60;
const payload = { lab, plan: planArg, iat: now, exp };
if (devices.length) payload.dev = devices;
const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
// IEEE-P1363 (raw r||s) so the browser's WebCrypto can verify it directly.
const sig = crypto.sign("sha256", Buffer.from(payloadB64), { key: privateKey, dsaEncoding: "ieee-p1363" });
const key = payloadB64 + "." + b64url(sig);

console.log("\n  Lab:     " + lab);
console.log("  Plan:    " + planArg + " (" + days + " days)");
console.log("  Expires: " + new Date(exp * 1000).toDateString());
console.log("  Devices: " + (devices.length ? devices.join(", ") + ` (max 2)` : "ANY (unlocked — your own keys only)"));
console.log("\n  ── Activation key (send to the lab) ──\n");
console.log("  " + key + "\n");

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
