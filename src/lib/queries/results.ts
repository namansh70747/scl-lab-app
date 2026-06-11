import { dbQuery, dbExecute, dbTransaction } from '@/lib/db';
import { Order, Result, OrderWithResult, Test } from '@/types';

export async function getOrdersWithResults(patientId: number): Promise<OrderWithResult[]> {
  const rows = await dbQuery<Order & Test & { result_id: number; value: string; flag: string; entered_by: number; entered_at: string; approved_by: number; approved_at: string }>(
    `SELECT o.*, t.code, t.name, t.result_type, t.unit, t.decimals, t.choices, t.default_value, t.formula, t.interpretation_note, t.panel_id, t.sort_order,
            r.id as result_id, r.value, r.flag, r.entered_by, r.entered_at, r.approved_by, r.approved_at
     FROM orders o
     JOIN tests t ON o.test_id=t.id
     LEFT JOIN results r ON r.order_id=o.id
     WHERE o.patient_id=?
     ORDER BY t.sort_order`,
    [patientId]
  );

  return rows.map(r => ({
    order: { id: r.id, patient_id: r.patient_id, test_id: r.test_id, price_charged: r.price_charged, sample_id: r.sample_id, not_done: r.not_done },
    test: { id: r.test_id, code: r.code, name: r.name, result_type: r.result_type, unit: r.unit, decimals: r.decimals, choices: r.choices, default_value: r.default_value, formula: r.formula, interpretation_note: r.interpretation_note, panel_id: r.panel_id, sort_order: r.sort_order, price: r.price_charged, enabled: 1, is_panel: 0, needs_review: 0 },
    ranges: [],
    result: r.result_id ? { id: r.result_id, order_id: r.id, value: r.value, flag: r.flag as never, entered_by: r.entered_by, entered_at: r.entered_at, approved_by: r.approved_by, approved_at: r.approved_at } : null,
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

export async function markNotDone(orderId: number): Promise<void> {
  await dbExecute('UPDATE orders SET not_done=1 WHERE id=?', [orderId]);
}
