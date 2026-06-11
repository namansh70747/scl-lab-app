import { dbQuery } from '@/lib/db';

export interface DayBookRow { test_no: number; name: string; registered_at: string; doctor_name: string | null; total: number; received: number; balance: number; mode: string; }
export interface MonthlyRow { month: string; patients: number; total: number; received: number; balance: number; }
export interface DoctorWiseRow { doctor_name: string; patients: number; total: number; received: number; }
export interface TestWiseRow { code: string; name: string; count: number; revenue: number; }
export interface PendingRow { test_no: number; name: string; phone: string; registered_at: string; balance: number; }

export async function dayBook(from: string, to: string): Promise<DayBookRow[]> {
  return dbQuery<DayBookRow>(
    `SELECT p.test_no, p.name, p.registered_at, d.name as doctor_name,
            COALESCE(b.total,0) total, COALESCE(b.received,0) received, COALESCE(b.balance,0) balance, b.mode
     FROM patients p
     LEFT JOIN bills b ON b.patient_id=p.id
     LEFT JOIN doctors d ON p.doctor_id=d.id
     WHERE date(p.registered_at,'localtime') BETWEEN ? AND ?
     ORDER BY p.registered_at`,
    [from, to]
  );
}

export async function monthly(year: string): Promise<MonthlyRow[]> {
  return dbQuery<MonthlyRow>(
    `SELECT strftime('%Y-%m', p.registered_at, 'localtime') as month,
            COUNT(DISTINCT p.id) patients,
            COALESCE(SUM(b.total),0) total, COALESCE(SUM(b.received),0) received, COALESCE(SUM(b.balance),0) balance
     FROM patients p LEFT JOIN bills b ON b.patient_id=p.id
     WHERE strftime('%Y', p.registered_at, 'localtime') = ?
     GROUP BY month ORDER BY month`,
    [year]
  );
}

export async function doctorWise(from: string, to: string): Promise<DoctorWiseRow[]> {
  return dbQuery<DoctorWiseRow>(
    `SELECT COALESCE(d.name,'(none)') as doctor_name,
            COUNT(DISTINCT p.id) patients, COALESCE(SUM(b.total),0) total, COALESCE(SUM(b.received),0) received
     FROM patients p
     LEFT JOIN doctors d ON p.doctor_id=d.id
     LEFT JOIN bills b ON b.patient_id=p.id
     WHERE date(p.registered_at,'localtime') BETWEEN ? AND ?
     GROUP BY d.id ORDER BY patients DESC`,
    [from, to]
  );
}

export async function testWise(from: string, to: string): Promise<TestWiseRow[]> {
  return dbQuery<TestWiseRow>(
    `SELECT t.code, t.name, COUNT(o.id) count, COALESCE(SUM(o.price_charged),0) revenue
     FROM orders o
     JOIN tests t ON o.test_id=t.id
     JOIN patients p ON o.patient_id=p.id
     WHERE date(p.registered_at,'localtime') BETWEEN ? AND ?
     GROUP BY t.id ORDER BY count DESC`,
    [from, to]
  );
}

export async function pendingBalances(): Promise<PendingRow[]> {
  return dbQuery<PendingRow>(
    `SELECT p.test_no, p.name, p.phone, p.registered_at, b.balance
     FROM patients p JOIN bills b ON b.patient_id=p.id
     WHERE b.balance > 0
     ORDER BY p.registered_at DESC`
  );
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}
