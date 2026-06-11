import { dbQuery, dbExecute } from '@/lib/db';

export async function getSetting(key: string): Promise<string | null> {
  const rows = await dbQuery<{ value: string }>('SELECT value FROM settings WHERE key=?', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await dbExecute(
    'INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP',
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await dbQuery<{ key: string; value: string }>('SELECT key,value FROM settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
