import { dbQuery, dbExecute, dbTransaction, getDb } from '@/lib/db';
import { Patient, PatientWithStatus, NewPatientInput, Bill, PaymentMode } from '@/types';
import { getSetting, setSetting } from './settings';
import { writeAudit } from './audit';
import { nowISO } from '@/lib/format';

export async function getNextTestNo(): Promise<number> {
  const val = await getSetting('next_test_no');
  return parseInt(val ?? '1', 10);
}

export async function createPatient(input: NewPatientInput, userId: number): Promise<number> {
  let patientId = 0;

  await dbTransaction(async (db) => {
    const nextNo = await getNextTestNo();
    const sampleTime = input.sample_time || nowISO();

    await db.execute(
      `INSERT INTO patients(test_no,title,name,age,age_unit,sex,phone,email,address,doctor_id,collected_at,registered_at,sample_time)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`,
      [nextNo, input.title, input.name.toUpperCase(), input.age, input.age_unit,
       input.sex, input.phone, input.email || null, input.address,
       input.doctor_id, input.collected_at, sampleTime]
    );

    const rows = await db.select<{ id: number }[]>('SELECT last_insert_rowid() as id');
    patientId = (rows as unknown as { id: number }[])[0]?.id ?? 0;

    // Insert orders
    for (const testId of input.test_ids) {
      const price = input.prices[testId] ?? 0;
      await db.execute(
        'INSERT INTO orders(patient_id,test_id,price_charged,sample_id) VALUES(?,?,?,?)',
        [patientId, testId, price, String(nextNo)]
      );
    }

    // Insert bill
    const total = Object.values(input.prices).reduce((a, b) => a + b, 0);
    await db.execute(
      'INSERT INTO bills(patient_id,total,concession,received,mode) VALUES(?,?,?,?,?)',
      [patientId, total, input.concession, input.received, input.mode]
    );

    // Bump next_test_no
    await db.execute(
      `INSERT INTO settings(key,value,updated_at) VALUES('next_test_no',?,CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
      [String(nextNo + 1)]
    );

    // Audit
    await db.execute(
      'INSERT INTO audit_log(user_id,action,entity,entity_id,after_json,at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)',
      [userId, 'patient.create', 'patients', patientId, JSON.stringify({ test_no: nextNo, name: input.name })]
    );
  });

  return patientId;
}

export async function searchPatients(query: string, limit = 50): Promise<PatientWithStatus[]> {
  const isNum = /^\d+$/.test(query.trim());
  let sql: string;
  let params: unknown[];

  if (isNum) {
    sql = `SELECT p.*, d.name as doctor_name,
             b.total, b.concession, b.net, b.received, b.balance, b.mode,
             COUNT(o.id) as test_count,
             SUM(CASE WHEN r.approved_at IS NOT NULL THEN 1 ELSE 0 END) as approved_count
           FROM patients p
           LEFT JOIN doctors d ON p.doctor_id=d.id
           LEFT JOIN bills b ON b.patient_id=p.id
           LEFT JOIN orders o ON o.patient_id=p.id
           LEFT JOIN results r ON r.order_id=o.id
           WHERE p.test_no=?
           GROUP BY p.id ORDER BY p.registered_at DESC LIMIT ?`;
    params = [parseInt(query), limit];
  } else {
    sql = `SELECT p.*, d.name as doctor_name,
             b.total, b.concession, b.net, b.received, b.balance, b.mode,
             COUNT(o.id) as test_count,
             SUM(CASE WHEN r.approved_at IS NOT NULL THEN 1 ELSE 0 END) as approved_count
           FROM patients p
           LEFT JOIN doctors d ON p.doctor_id=d.id
           LEFT JOIN bills b ON b.patient_id=p.id
           LEFT JOIN orders o ON o.patient_id=p.id
           LEFT JOIN results r ON r.order_id=o.id
           WHERE p.name LIKE ? OR p.phone LIKE ?
           GROUP BY p.id ORDER BY p.registered_at DESC LIMIT ?`;
    params = [`${query}%`, `${query}%`, limit];
  }

  type FlatRow = Patient & { doctor_name: string; total: number; concession: number; net: number; received: number; balance: number; mode: string; test_count: number; approved_count: number };
  const rows = await dbQuery<FlatRow>(sql, params);
  return rows.map(r => ({
    ...r,
    bill: { id: 0, patient_id: r.id, total: r.total ?? 0, concession: r.concession ?? 0, net: r.net ?? 0, received: r.received ?? 0, balance: r.balance ?? 0, mode: (r.mode as PaymentMode) ?? 'CASH' } as Bill,
    status: deriveStatus(r.test_count, r.approved_count),
  }));
}

export async function getTodayPatients(): Promise<PatientWithStatus[]> {
  const rows = await dbQuery<PatientWithStatus & { test_count: number; approved_count: number; doctor_name: string; total: number; concession: number; net: number; received: number; balance: number; mode: string }>(
    `SELECT p.*, d.name as doctor_name,
       b.total, b.concession, b.net, b.received, b.balance, b.mode,
       COUNT(o.id) as test_count,
       SUM(CASE WHEN r.approved_at IS NOT NULL THEN 1 ELSE 0 END) as approved_count
     FROM patients p
     LEFT JOIN doctors d ON p.doctor_id=d.id
     LEFT JOIN bills b ON b.patient_id=p.id
     LEFT JOIN orders o ON o.patient_id=p.id
     LEFT JOIN results r ON r.order_id=o.id
     WHERE date(p.registered_at,'localtime')=date('now','localtime')
     GROUP BY p.id ORDER BY p.registered_at DESC`
  );
  return rows.map(r => ({
    ...r,
    bill: { id: 0, patient_id: r.id, total: r.total ?? 0, concession: r.concession ?? 0, net: r.net ?? 0, received: r.received ?? 0, balance: r.balance ?? 0, mode: r.mode as never ?? 'CASH' },
    status: deriveStatus(r.test_count, r.approved_count),
  }));
}

export async function getPatientById(id: number): Promise<Patient | null> {
  const rows = await dbQuery<Patient & { doctor_name: string }>(
    `SELECT p.*, d.name as doctor_name FROM patients p LEFT JOIN doctors d ON p.doctor_id=d.id WHERE p.id=?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getBill(patientId: number): Promise<Bill | null> {
  const rows = await dbQuery<Bill>('SELECT * FROM bills WHERE patient_id=?', [patientId]);
  return rows[0] ?? null;
}

export async function updateBill(patientId: number, data: Partial<Bill>): Promise<void> {
  const fields = Object.keys(data).filter(k => k !== 'patient_id' && k !== 'id' && k !== 'net' && k !== 'balance');
  if (!fields.length) return;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as Record<string, unknown>)[f]);
  await dbExecute(`UPDATE bills SET ${sets},updated_at=CURRENT_TIMESTAMP WHERE patient_id=?`, [...vals, patientId]);
}

function deriveStatus(testCount: number, approvedCount: number): 'registered' | 'results_pending' | 'approved' {
  if (testCount === 0) return 'registered';
  if (approvedCount >= testCount) return 'approved';
  return 'results_pending';
}

export async function getDashboardStats(): Promise<{
  todayCount: number;
  pendingCount: number;
  approvedCount: number;
  todayCollection: number;
  balanceDue: number;
}> {
  const rows = await dbQuery<{
    total_patients: number;
    pending: number;
    approved: number;
    collection: number;
    balance: number;
  }>(
    `SELECT
       COUNT(DISTINCT p.id) as total_patients,
       COUNT(DISTINCT CASE WHEN r.approved_at IS NULL AND o.id IS NOT NULL THEN p.id END) as pending,
       COUNT(DISTINCT CASE WHEN p.report_time IS NOT NULL THEN p.id END) as approved,
       COALESCE(SUM(b.received),0) as collection,
       COALESCE(SUM(b.balance),0) as balance
     FROM patients p
     LEFT JOIN bills b ON b.patient_id=p.id
     LEFT JOIN orders o ON o.patient_id=p.id
     LEFT JOIN results r ON r.order_id=o.id
     WHERE date(p.registered_at,'localtime')=date('now','localtime')`
  );
  const r = rows[0];
  return {
    todayCount: r?.total_patients ?? 0,
    pendingCount: r?.pending ?? 0,
    approvedCount: r?.approved ?? 0,
    todayCollection: r?.collection ?? 0,
    balanceDue: r?.balance ?? 0,
  };
}
