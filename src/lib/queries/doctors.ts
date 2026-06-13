import { dbQuery, dbExecute } from '@/lib/db';
import { Doctor } from '@/types';

export async function listDoctors(activeOnly = true): Promise<Doctor[]> {
  // Most-referred doctors first so the common ones are top of the dropdown (counter speed).
  return dbQuery<Doctor>(
    `SELECT d.* FROM doctors d${activeOnly ? ' WHERE d.active=1' : ''}
     ORDER BY (SELECT COUNT(*) FROM patients p WHERE p.doctor_id=d.id) DESC, d.name`
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

/** Rename / edit an existing doctor by id (the upsert keys on name, so it can't rename). */
export async function updateDoctor(id: number, name: string, degree?: string): Promise<void> {
  await dbExecute(
    'UPDATE doctors SET name=?, degree=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [name, degree ?? null, id]
  );
}

export async function setDoctorActive(id: number, active: number): Promise<void> {
  await dbExecute('UPDATE doctors SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [active, id]);
}

export interface DoctorWithCount extends Doctor {
  referral_count: number;
}

export async function listDoctorsWithCounts(): Promise<DoctorWithCount[]> {
  return dbQuery<DoctorWithCount>(
    `SELECT d.*, COUNT(p.id) as referral_count
     FROM doctors d LEFT JOIN patients p ON p.doctor_id=d.id
     GROUP BY d.id ORDER BY d.name`
  );
}

export async function referralSummary(doctorId: number, from: string, to: string): Promise<{ patients: number; total: number; received: number; balance: number }> {
  const rows = await dbQuery<{ patients: number; total: number; received: number; balance: number }>(
    `SELECT COUNT(DISTINCT p.id) as patients,
            COALESCE(SUM(b.total),0) as total,
            COALESCE(SUM(b.received),0) as received,
            COALESCE(SUM(b.balance),0) as balance
     FROM patients p LEFT JOIN bills b ON b.patient_id=p.id
     WHERE p.doctor_id=? AND date(p.registered_at,'localtime') BETWEEN ? AND ?`,
    [doctorId, from, to]
  );
  return rows[0] ?? { patients: 0, total: 0, received: 0, balance: 0 };
}
