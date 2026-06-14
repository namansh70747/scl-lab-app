import { dbQuery, dbExecute } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { User } from "@/types";

/** First-run: has the lab set up its own account + identity yet? (settings flag) */
export async function needsSetup(): Promise<boolean> {
  const rows = await dbQuery<{ value: string }>("SELECT value FROM settings WHERE key='setup_done'");
  return (rows[0]?.value ?? "") !== "1";
}

/**
 * DEV/testing only — returns the install to genuine first-run state so the full
 * pay → activation key → set-up-lab → dashboard flow can be walked through again.
 * Clears the setup flag + stored licence and resets the admin to the seeded placeholder.
 * Guarded by import.meta.env.DEV at every call site, so it never ships to customers.
 */
export async function resetInstallForTesting(): Promise<void> {
  await dbExecute("DELETE FROM settings WHERE key IN ('setup_done','license_key')");
  const admins = await dbQuery<{ id: number }>("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  if (admins[0]?.id) {
    await dbExecute(
      `UPDATE users SET username='admin', display_name='Administrator',
       password_hash='$argon2id$placeholder$changeme', force_password_change=1, active=1, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [admins[0].id]
    );
  }
}

/**
 * Complete first-run setup: the lab names itself and creates its own admin login (replacing
 * the seeded placeholder admin). Writes are ungated (there's no session yet). Returns the
 * new admin user for immediate sign-in.
 */
export interface SetupInput {
  labName: string;
  address: string;
  phones: string;
  timings: string;
  inchargeName: string;   // shown as the report signatory + the app account's display name
  inchargeQual: string;   // e.g. DMLT
  username: string;
  password: string;
}

export async function completeSetup(input: SetupInput): Promise<User> {
  const username = input.username.trim().toLowerCase();
  const incharge = input.inchargeName.trim() || input.username.trim();
  const hash = await hashPassword(input.password);

  const admins = await dbQuery<{ id: number }>("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  const adminId = admins[0]?.id;
  if (adminId) {
    await dbExecute(
      `UPDATE users SET username=?, display_name=?, password_hash=?, force_password_change=0, active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [username, incharge, hash, adminId]
    );
  } else {
    await dbExecute(
      `INSERT INTO users(username,display_name,role,password_hash,force_password_change,active) VALUES(?,?,'admin',?,0,1)`,
      [username, incharge, hash]
    );
  }

  // This lab's OWN letterhead/report identity, written ungated (no session yet). We also
  // CLEAR every Sharma-specific seed value (equipment list, footer test list, timings AND
  // the seeded sender email) so a new lab never inherits Sharma's details, never emails
  // patients FROM Sharma's gmail, and starts clean — they add their own later in Settings.
  // NOTE: setup_done is intentionally NOT in this list — it is written LAST (below), after the
  // doctor cleanup, so a failure mid-way never leaves a half-finished setup marked "complete".
  const settings: [string, string][] = [
    ["lab_name", input.labName.trim()],
    ["address_line", input.address.trim()],
    ["phones", input.phones.trim()],
    ["timings", input.timings.trim()],
    ["technician_name", incharge],
    ["technician_qual", input.inchargeQual.trim()],
    ["equipment_line", ""],
    ["footer_tests_line", ""],
    ["smtp_user", ""],   // was seeded with Sharma's personal gmail — must not leak across tenants
  ];
  for (const [k, v] of settings) {
    await dbExecute(
      `INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
      [k, v]
    );
  }

  // Drop the seeded referring doctors (Sharma's local Pathankot panel) so a new lab builds its
  // own list. FK-SAFE: patients.doctor_id REFERENCES doctors(id) ON DELETE RESTRICT, so we only
  // remove doctors no patient points at — otherwise the delete fails (code 1811). On a genuine
  // fresh install there are no patients, so all seeded doctors go; if any are in use they stay.
  // Wrapped so this cosmetic cleanup can never abort the whole setup.
  try {
    await dbExecute(
      "DELETE FROM doctors WHERE id NOT IN (SELECT doctor_id FROM patients WHERE doctor_id IS NOT NULL)"
    );
  } catch { /* non-fatal — keeping a few seeded doctors is far better than failing setup */ }

  // Mark setup complete LAST — only once everything above succeeded.
  await dbExecute(
    `INSERT INTO settings(key,value,updated_at) VALUES('setup_done','1',CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  );

  const rows = await dbQuery<User>("SELECT * FROM users WHERE username=? AND active=1", [username]);
  return rows[0];
}
