import { dbQuery, dbExecute } from '@/lib/db';
import { User } from '@/types';

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
  username: string, display_name: string, role: string, password_hash: string
): Promise<void> {
  await dbExecute(
    'INSERT INTO users(username,display_name,role,password_hash,force_password_change) VALUES(?,?,?,?,1)',
    [username, display_name, role, password_hash]
  );
}

export async function updatePasswordHash(userId: number, hash: string): Promise<void> {
  await dbExecute(
    'UPDATE users SET password_hash=?,force_password_change=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [hash, userId]
  );
}

export async function setUserActive(userId: number, active: number): Promise<void> {
  await dbExecute('UPDATE users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [active, userId]);
}
