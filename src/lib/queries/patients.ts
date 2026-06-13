import { dbQuery, dbExecute, getDb } from '@/lib/db';
import { Patient, PatientWithStatus, NewPatientInput, Bill, PaymentMode } from '@/types';
import { getSetting, setSetting } from './settings';
import { writeAudit } from './audit';
import { nowISO } from '@/lib/format';

export async function getNextTestNo(): Promise<number> {
  const val = await getSetting('next_test_no');
  return parseInt(val ?? '1', 10);
}

export async function createPatient(input: NewPatientInput, userId: number): Promise<number> {
  const db = await getDb();
  const nextNo = await getNextTestNo();
  const sampleTime = input.sample_time || nowISO();

  // Insert the patient and capture its id from THIS statement's result (pool-safe;
  // never read last_insert_rowid() in a separate call — it can hit another connection).
  const patientRes = await db.execute(
    `INSERT INTO patients(test_no,title,name,age,age_unit,sex,phone,email,address,doctor_id,collected_at,registered_at,sample_time)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`,
    [nextNo, input.title, input.name.toUpperCase(), input.age, input.age_unit,
     input.sex, input.phone || null, input.email || null, input.address || '',
     input.doctor_id, input.collected_at, sampleTime]
  );
  const patientId = patientRes.lastInsertId ?? 0;
  if (!patientId || patientId <= 0) {
    throw new Error('Could not create the patient record. Please try again.');
  }

  try {
    // Orders (price frozen at order time). A bundle test (is_panel=1) bills as one
    // line but expands into its panel's member tests for result entry: the bundle
    // order carries the price with not_done=1 (no result expected, excluded from
    // the report), and each member is ordered at ₹0.
    const meta = input.test_ids.length
      ? await dbQuery<{ id: number; is_panel: number; panel_id: number }>(
          `SELECT id, is_panel, panel_id FROM tests WHERE id IN (${input.test_ids.map(() => '?').join(',')})`,
          input.test_ids
        )
      : [];
    const metaById = new Map(meta.map(m => [m.id, m]));
    const orderedIds = new Set<number>();

    for (const testId of input.test_ids) {
      const price = input.prices[testId] ?? 0;
      const m = metaById.get(testId);

      if (m?.is_panel) {
        await db.execute(
          'INSERT INTO orders(patient_id,test_id,price_charged,sample_id,not_done) VALUES(?,?,?,?,1)',
          [patientId, testId, price, String(nextNo)]
        );
        orderedIds.add(testId);
        const children = await dbQuery<{ id: number }>(
          'SELECT id FROM tests WHERE panel_id=? AND enabled=1 AND is_panel=0',
          [m.panel_id]
        );
        for (const child of children) {
          if (orderedIds.has(child.id)) continue;
          await db.execute(
            'INSERT INTO orders(patient_id,test_id,price_charged,sample_id) VALUES(?,?,?,?)',
            [patientId, child.id, 0, String(nextNo)]
          );
          orderedIds.add(child.id);
        }
      } else {
        if (orderedIds.has(testId)) continue;
        await db.execute(
          'INSERT INTO orders(patient_id,test_id,price_charged,sample_id) VALUES(?,?,?,?)',
          [patientId, testId, price, String(nextNo)]
        );
        orderedIds.add(testId);
      }
    }

    // Bill (net/balance are generated columns). The lab collects payment manually at the
    // counter, so the bill is recorded as fully received — there is no balance-due tracking.
    const total = Object.values(input.prices).reduce((a, b) => a + b, 0);
    const concession = Math.max(0, Math.min(input.concession, total));   // never exceed total → no negative net/balance
    const received = total - concession;
    await db.execute(
      'INSERT INTO bills(patient_id,total,concession,received,mode) VALUES(?,?,?,?,?)',
      [patientId, total, concession, received, input.mode]
    );

    // Advance the receipt number
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
  } catch (err) {
    // Manual rollback — leave no orphaned/partial patient behind (replaces the
    // unreliable cross-connection BEGIN/COMMIT). Order matters (FK ON DELETE RESTRICT).
    await db.execute('DELETE FROM bills WHERE patient_id=?', [patientId]).catch(() => {});
    await db.execute('DELETE FROM orders WHERE patient_id=?', [patientId]).catch(() => {});
    await db.execute('DELETE FROM patients WHERE id=?', [patientId]).catch(() => {});
    throw err;
  }

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
    status: deriveStatus(r.test_count, r.report_time),
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
    status: deriveStatus(r.test_count, r.report_time),
  }));
}

export async function getPatientById(id: number): Promise<Patient | null> {
  const rows = await dbQuery<Patient & { doctor_name: string }>(
    `SELECT p.*, d.name as doctor_name FROM patients p LEFT JOIN doctors d ON p.doctor_id=d.id WHERE p.id=?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updatePatient(id: number, data: Partial<Patient>, userId: number): Promise<void> {
  const allowed = ['title', 'name', 'age', 'age_unit', 'sex', 'phone', 'email', 'address', 'doctor_id', 'collected_at'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) return;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as Record<string, unknown>)[f]);
  await dbExecute(`UPDATE patients SET ${sets},updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...vals, id]);
  await writeAudit(userId, 'patient.update', 'patients', id, null, data);
}

/** All past visits for a returning patient (matched by name + phone) — for the
 *  history Sheet and "copy from previous visit". */
export async function getPatientHistory(name: string, phone: string): Promise<PatientWithStatus[]> {
  const rows = await dbQuery<Patient & { doctor_name: string; total: number; net: number; received: number; balance: number; concession: number; mode: string; test_count: number; approved_count: number }>(
    `SELECT p.*, d.name as doctor_name, b.total, b.concession, b.net, b.received, b.balance, b.mode,
       COUNT(o.id) as test_count,
       SUM(CASE WHEN r.approved_at IS NOT NULL THEN 1 ELSE 0 END) as approved_count
     FROM patients p
     LEFT JOIN doctors d ON p.doctor_id=d.id
     LEFT JOIN bills b ON b.patient_id=p.id
     LEFT JOIN orders o ON o.patient_id=p.id
     LEFT JOIN results r ON r.order_id=o.id
     WHERE p.name=? AND (p.phone=? OR ?='')
     GROUP BY p.id ORDER BY p.registered_at DESC`,
    [name, phone, phone]
  );
  return rows.map(r => ({
    ...r,
    bill: { id: 0, patient_id: r.id, total: r.total ?? 0, concession: r.concession ?? 0, net: r.net ?? 0, received: r.received ?? 0, balance: r.balance ?? 0, mode: (r.mode as PaymentMode) ?? 'CASH' },
    status: deriveStatus(r.test_count, r.report_time),
  }));
}

export async function getBill(patientId: number): Promise<Bill | null> {
  const rows = await dbQuery<Bill>('SELECT * FROM bills WHERE patient_id=?', [patientId]);
  return rows[0] ?? null;
}

/**
 * Add more tests to an already-registered patient (e.g. the patient asks for another test).
 * New orders are appended (bundles expand like at registration) and the bill grows; the
 * extra amount is recorded as received too, so there is no balance due.
 */
export async function addTestsToPatient(
  patientId: number, testIds: number[], prices: Record<number, number>
): Promise<void> {
  if (!testIds.length) return;
  const db = await getDb();
  const existing = await dbQuery<{ test_id: number }>('SELECT test_id FROM orders WHERE patient_id=?', [patientId]);
  const have = new Set(existing.map(e => e.test_id));
  const sampleRow = await dbQuery<{ sample_id: string }>('SELECT sample_id FROM orders WHERE patient_id=? LIMIT 1', [patientId]);
  const sampleId = sampleRow[0]?.sample_id ?? String(patientId);

  const meta = await dbQuery<{ id: number; is_panel: number; panel_id: number }>(
    `SELECT id, is_panel, panel_id FROM tests WHERE id IN (${testIds.map(() => '?').join(',')})`, testIds
  );
  const metaById = new Map(meta.map(m => [m.id, m]));

  let addedTotal = 0;
  for (const testId of testIds) {
    if (have.has(testId)) continue;
    const price = prices[testId] ?? 0;
    const m = metaById.get(testId);
    if (m?.is_panel) {
      await db.execute('INSERT INTO orders(patient_id,test_id,price_charged,sample_id,not_done) VALUES(?,?,?,?,1)', [patientId, testId, price, sampleId]);
      have.add(testId); addedTotal += price;
      const children = await dbQuery<{ id: number }>('SELECT id FROM tests WHERE panel_id=? AND enabled=1 AND is_panel=0', [m.panel_id]);
      for (const child of children) {
        if (have.has(child.id)) continue;
        await db.execute('INSERT INTO orders(patient_id,test_id,price_charged,sample_id) VALUES(?,?,?,?)', [patientId, child.id, 0, sampleId]);
        have.add(child.id);
      }
    } else {
      await db.execute('INSERT INTO orders(patient_id,test_id,price_charged,sample_id) VALUES(?,?,?,?)', [patientId, testId, price, sampleId]);
      have.add(testId); addedTotal += price;
    }
  }
  if (addedTotal > 0) {
    await db.execute(
      'UPDATE bills SET total = total + ?, received = received + ?, updated_at=CURRENT_TIMESTAMP WHERE patient_id=?',
      [addedTotal, addedTotal, patientId]
    );
  }
}

export async function updateBill(patientId: number, data: Partial<Bill>): Promise<void> {
  const fields = Object.keys(data).filter(k => k !== 'patient_id' && k !== 'id' && k !== 'net' && k !== 'balance');
  if (!fields.length) return;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as Record<string, unknown>)[f]);
  await dbExecute(`UPDATE bills SET ${sets},updated_at=CURRENT_TIMESTAMP WHERE patient_id=?`, [...vals, patientId]);
}

/**
 * Approval status from report_time — set by approvePatient. Counting approved results
 * against COUNT(orders) was wrong: bundle rows, not-done rows and uncomputable calculated
 * rows never get an approved result, so multi-test patients were stuck on "results pending".
 */
function deriveStatus(testCount: number, reportTime: string | null): 'registered' | 'results_pending' | 'approved' {
  if (reportTime) return 'approved';
  if (testCount === 0) return 'registered';
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
    // NOTE: money totals are computed in subqueries over bills ONLY. Summing them across
    // the orders/results join would multiply each bill by the patient's test count.
    // Approval is tracked by patients.report_time (set on approve). Counting unapproved
    // results would keep approved patients "pending" because bundle/not-done/calculated
    // rows never carry an approved result. Money totals use bills-only subqueries.
    `SELECT
       COUNT(DISTINCT p.id) as total_patients,
       COUNT(DISTINCT CASE WHEN p.report_time IS NULL AND o.id IS NOT NULL THEN p.id END) as pending,
       COUNT(DISTINCT CASE WHEN p.report_time IS NOT NULL THEN p.id END) as approved,
       (SELECT COALESCE(SUM(b2.received),0) FROM bills b2 JOIN patients p2 ON p2.id=b2.patient_id
          WHERE date(p2.registered_at,'localtime')=date('now','localtime')) as collection,
       (SELECT COALESCE(SUM(b2.balance),0) FROM bills b2 JOIN patients p2 ON p2.id=b2.patient_id
          WHERE date(p2.registered_at,'localtime')=date('now','localtime')) as balance
     FROM patients p
     LEFT JOIN orders o ON o.patient_id=p.id
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
