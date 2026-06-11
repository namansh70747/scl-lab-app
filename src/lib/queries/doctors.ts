import { dbQuery, dbExecute } from '@/lib/db';
import { Doctor } from '@/types';

export async function listDoctors(activeOnly = true): Promise<Doctor[]> {
  return dbQuery<Doctor>(
    `SELECT * FROM doctors${activeOnly ? ' WHERE active=1' : ''} ORDER BY name`
  );
}

export async function upsertDoctor(name: string, degree?: string): Promise<number> {
  await dbExecute(
    `INSERT INTO doctors(name,degree) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET degree=excluded.degree, updated_at=CURRENT_TIMESTAMP`,
    [name, degree ?? null]
  );
  const rows = await dbQuery<{ id: number }>('SELECT id FROM doctors WHERE name=?', [name]);
  return rows[0]?.id ?? 0;
}

export async function setDoctorActive(id: number, active: number): Promise<void> {
  await dbExecute('UPDATE doctors SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [active, id]);
}
