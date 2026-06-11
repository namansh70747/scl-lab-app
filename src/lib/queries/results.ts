import { dbQuery, dbExecute, dbTransaction } from '@/lib/db';
import { Result, OrderWithResult, Test, TestRange, ResultType, Flag } from '@/types';
import { assertCan } from '@/lib/session';

interface OrderFlatRow {
  // order
  id: number;
  patient_id: number;
  test_id: number;
  price_charged: number;
  sample_id: string;
  not_done: number;
  // test
  code: string;
  name: string;
  result_type: ResultType;
  unit: string;
  decimals: number;
  choices: string | null;
  default_value: string | null;
  is_panel: number;
  formula: string | null;
  interpretation_note: string | null;
  panel_id: number;
  test_sort_order: number;
  panel_code: string | null;
  panel_heading: string | null;
  panel_sort_order: number | null;
  // result
  result_id: number | null;
  value: string | null;
  flag: string | null;
  entered_by: number | null;
  entered_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
}

export async function getOrdersWithResults(patientId: number): Promise<OrderWithResult[]> {
  const rows = await dbQuery<OrderFlatRow>(
    `SELECT o.id, o.patient_id, o.test_id, o.price_charged, o.sample_id, o.not_done,
            t.code, t.name, t.result_type, t.unit, t.decimals, t.choices, t.default_value, t.is_panel,
            t.formula, t.interpretation_note, t.panel_id, t.sort_order AS test_sort_order,
            p.code AS panel_code, p.report_heading AS panel_heading, p.sort_order AS panel_sort_order,
            r.id AS result_id, r.value, r.flag, r.entered_by, r.entered_at, r.approved_by, r.approved_at
     FROM orders o
     JOIN tests t ON o.test_id = t.id
     LEFT JOIN panels p ON t.panel_id = p.id
     LEFT JOIN results r ON r.order_id = o.id
     WHERE o.patient_id = ?
     ORDER BY p.sort_order, t.sort_order, t.name`,
    [patientId]
  );

  // Batch-load all ranges for the involved tests in a single query.
  const testIds = [...new Set(rows.map(r => r.test_id))];
  let rangesByTest: Record<number, TestRange[]> = {};
  if (testIds.length) {
    const placeholders = testIds.map(() => '?').join(',');
    const allRanges = await dbQuery<TestRange>(
      `SELECT * FROM test_ranges WHERE test_id IN (${placeholders}) ORDER BY sex, age_min_days`,
      testIds
    );
    rangesByTest = allRanges.reduce<Record<number, TestRange[]>>((acc, rg) => {
      (acc[rg.test_id] ||= []).push(rg);
      return acc;
    }, {});
  }

  return rows.map(r => ({
    order: {
      id: r.id, patient_id: r.patient_id, test_id: r.test_id,
      price_charged: r.price_charged, sample_id: r.sample_id, not_done: r.not_done,
    },
    test: {
      id: r.test_id, code: r.code, name: r.name, result_type: r.result_type,
      unit: r.unit, decimals: r.decimals, choices: r.choices, default_value: r.default_value,
      formula: r.formula, interpretation_note: r.interpretation_note, panel_id: r.panel_id,
      panel_code: r.panel_code ?? undefined, panel_heading: r.panel_heading ?? undefined,
      sort_order: r.test_sort_order, price: r.price_charged, enabled: 1, is_panel: r.is_panel, needs_review: 0,
    },
    ranges: rangesByTest[r.test_id] ?? [],
    result: r.result_id
      ? {
          id: r.result_id, order_id: r.id, value: r.value ?? '', flag: (r.flag ?? '') as Flag,
          entered_by: r.entered_by, entered_at: r.entered_at,
          approved_by: r.approved_by, approved_at: r.approved_at,
        }
      : null,
  }));
}

export async function saveResult(orderId: number, value: string, flag: string, userId: number): Promise<void> {
  await dbExecute(
    `INSERT INTO results(order_id,value,flag,entered_by,entered_at,updated_at)
     VALUES(?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT(order_id) DO UPDATE SET
       value=excluded.value, flag=excluded.flag, entered_by=excluded.entered_by,
       entered_at=excluded.entered_at, updated_at=CURRENT_TIMESTAMP`,
    [orderId, value, flag, userId]
  );
}

export async function approvePatient(patientId: number, userId: number): Promise<void> {
  assertCan('approve');

  // Integrity gate (§4.14): every active ordered test must have a saved result.
  // Tests with no value must be explicitly marked "not done" first.
  const missing = await dbQuery<{ name: string }>(
    `SELECT t.name FROM orders o
     JOIN tests t ON o.test_id = t.id
     LEFT JOIN results r ON r.order_id = o.id
     WHERE o.patient_id = ? AND o.not_done = 0 AND t.result_type != 'calculated'
       AND (r.id IS NULL OR r.value IS NULL OR TRIM(r.value) = '')`,
    [patientId]
  );
  if (missing.length > 0) {
    throw new Error(
      `Cannot approve — no result entered for: ${missing.map(m => m.name).join(', ')}. Enter values or mark them "not done".`
    );
  }

  await dbTransaction(async (db) => {
    await db.execute(
      `UPDATE results SET approved_by=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE order_id IN (SELECT id FROM orders WHERE patient_id=?)
       AND approved_at IS NULL`,
      [userId, patientId]
    );
    await db.execute(
      'UPDATE patients SET report_time=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [patientId]
    );
    await db.execute(
      'INSERT INTO audit_log(user_id,action,entity,entity_id,at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)',
      [userId, 'result.approve', 'patients', patientId]
    );
  });
}

export async function unlockResult(orderId: number, reason: string, userId: number): Promise<void> {
  assertCan('unlock_results');
  const current = await dbQuery<Result>('SELECT * FROM results WHERE order_id=?', [orderId]);
  await dbTransaction(async (db) => {
    await db.execute(
      'UPDATE results SET approved_by=NULL,approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?',
      [orderId]
    );
    await db.execute(
      'INSERT INTO audit_log(user_id,action,entity,entity_id,before_json,after_json,at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)',
      [userId, 'result.unlock', 'results', orderId, JSON.stringify(current[0]), JSON.stringify({ reason })]
    );
  });
}

export async function markNotDone(orderId: number, notDone = 1): Promise<void> {
  await dbExecute('UPDATE orders SET not_done=? WHERE id=?', [notDone, orderId]);
}

export async function getReportComment(patientId: number): Promise<string> {
  const rows = await dbQuery<{ comment: string }>(
    'SELECT comment FROM report_comments WHERE patient_id=?',
    [patientId]
  );
  return rows[0]?.comment ?? '';
}

export async function saveReportComment(patientId: number, comment: string): Promise<void> {
  await dbExecute(
    `INSERT INTO report_comments(patient_id, comment, updated_at)
     VALUES(?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(patient_id) DO UPDATE SET comment=excluded.comment, updated_at=CURRENT_TIMESTAMP`,
    [patientId, comment]
  );
}
