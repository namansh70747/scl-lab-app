import { dbQuery, dbExecute } from '@/lib/db';
import { User } from '@/types';
import { hashPassword, verifyPassword, isPlaceholderHash } from '@/lib/password';
import { assertCan } from '@/lib/session';

// ── Login lockout (in-memory; single-PC app) ──
// Gentle, not punishing: a short cooldown after several wrong tries against an
// EXISTING account. Typing an unknown username never escalates the lockout, so a
// typo can't lock the real account out. Cleared on app restart.
const LOCK_THRESHOLD = 6;
const LOCK_MS = 20_000;
const attempts = new Map<string, { count: number; until: number }>();

export function lockoutRemainingMs(username: string): number {
  const a = attempts.get(username.trim().toLowerCase());
  if (!a || a.until < Date.now()) return 0;
  return a.until - Date.now();
}

function recordFail(username: string) {
  const key = username.trim().toLowerCase();
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= LOCK_THRESHOLD) a.until = Date.now() + LOCK_MS;
  attempts.set(key, a);
}
function clearFails(username: string) { attempts.delete(username.trim().toLowerCase()); }

/** Active usernames for the login account picker (prevents username typos). */
export async function listLoginAccounts(): Promise<{ username: string; display_name: string; role: string }[]> {
  return dbQuery<{ username: string; display_name: string; role: string }>(
    'SELECT username, display_name, role FROM users WHERE active=1 ORDER BY role DESC, username'
  );
}

export interface LoginResult {
  ok: boolean;
  user?: User;
  error?: string;
  mustSetPassword?: boolean;
}

/** Verifies credentials with lockout + first-run placeholder handling, and audit-logs
 *  the attempt. On a placeholder hash, any password is accepted once and the caller is
 *  told to force a password reset. */
export async function login(username: string, password: string): Promise<LoginResult> {
  const remaining = lockoutRemainingMs(username);
  if (remaining > 0) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.` };
  }
  const user = await getUserByUsername(username);
  // Unknown username = a typo, not a brute-force attempt: don't escalate lockout.
  if (!user) {
    return { ok: false, error: `No account named "${username.trim()}". Pick an account below.` };
  }

  if (isPlaceholderHash(user.password_hash)) {
    clearFails(username);
    return { ok: true, user, mustSetPassword: true };
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) { recordFail(username); return { ok: false, error: 'Invalid username or password' }; }

  clearFails(username);
  return { ok: true, user, mustSetPassword: user.force_password_change === 1 };
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const rows = await dbQuery<User>(
    'SELECT * FROM users WHERE username=? AND active=1',
    [username]
  );
  return rows[0] ?? null;
}

export async function listUsers(): Promise<User[]> {
  return dbQuery<User>('SELECT * FROM users ORDER BY username');
}

export async function createUser(
  username: string, display_name: string, role: string, plainPassword: string
): Promise<void> {
  assertCan('manage_users');
  const hash = await hashPassword(plainPassword);
  await dbExecute(
    'INSERT INTO users(username,display_name,role,password_hash,force_password_change) VALUES(?,?,?,?,1)',
    [username.trim().toLowerCase(), display_name, role, hash]
  );
}

/** Set a brand-new password for the current user (first-run / self change). */
export async function setOwnPassword(userId: number, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await dbExecute(
    'UPDATE users SET password_hash=?,force_password_change=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [hash, userId]
  );
}

/** Admin resets another user's password (forces change on next login). */
export async function adminResetPassword(userId: number, newPassword: string): Promise<void> {
  assertCan('manage_users');
  const hash = await hashPassword(newPassword);
  await dbExecute(
    'UPDATE users SET password_hash=?,force_password_change=1,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [hash, userId]
  );
}

async function activeAdminCount(): Promise<number> {
  const rows = await dbQuery<{ n: number }>("SELECT COUNT(*) as n FROM users WHERE role='admin' AND active=1");
  return rows[0]?.n ?? 0;
}

async function isLastActiveAdmin(userId: number): Promise<boolean> {
  const rows = await dbQuery<{ role: string; active: number }>('SELECT role, active FROM users WHERE id=?', [userId]);
  const u = rows[0];
  return !!u && u.role === 'admin' && u.active === 1 && (await activeAdminCount()) <= 1;
}

export async function setUserRole(userId: number, role: 'admin' | 'technician'): Promise<void> {
  assertCan('manage_users');
  if (role !== 'admin' && (await isLastActiveAdmin(userId))) {
    throw new Error('Cannot demote the last active admin — make another user an admin first.');
  }
  await dbExecute('UPDATE users SET role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [role, userId]);
}

export async function setUserActive(userId: number, active: number): Promise<void> {
  assertCan('manage_users');
  if (active === 0 && (await isLastActiveAdmin(userId))) {
    throw new Error('Cannot deactivate the last active admin — make another user an admin first.');
  }
  await dbExecute('UPDATE users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [active, userId]);
}
