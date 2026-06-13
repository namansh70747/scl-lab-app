import { dbQuery, dbExecute } from '@/lib/db';
import { Test, TestRange, Panel } from '@/types';
import { assertCan, currentUserId } from '@/lib/session';
import { writeAudit } from './audit';

export async function listPanels(): Promise<Panel[]> {
  return dbQuery<Panel>('SELECT * FROM panels ORDER BY sort_order');
}

export async function listTests(panelCode?: string, enabledOnly = true): Promise<Test[]> {
  let sql = `SELECT t.*, p.code as panel_code, p.report_heading as panel_heading
             FROM tests t LEFT JOIN panels p ON t.panel_id=p.id`;
  const params: unknown[] = [];
  const where: string[] = [];
  if (enabledOnly) where.push('t.enabled=1');
  if (panelCode) { where.push('p.code=?'); params.push(panelCode); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY p.sort_order, t.sort_order, t.name';
  return dbQuery<Test>(sql, params);
}

export async function searchTests(query: string): Promise<Test[]> {
  // Frequently-ordered tests float to the top, and an exact code-prefix match wins —
  // so typing "CB" instantly surfaces the most-used CBC at #1 (counter speed).
  const sql = `SELECT t.*, p.code as panel_code, p.report_heading as panel_heading
               FROM tests t LEFT JOIN panels p ON t.panel_id=p.id
               WHERE t.enabled=1 AND (t.code LIKE ? OR t.name LIKE ?)
               ORDER BY (CASE WHEN t.code LIKE ? THEN 0 ELSE 1 END),
                        (SELECT COUNT(*) FROM orders o WHERE o.test_id=t.id) DESC,
                        t.code
               LIMIT 30`;
  return dbQuery<Test>(sql, [`${query}%`, `%${query}%`, `${query}%`]);
}

/** Most-ordered tests/panels — one-tap chips so the common cases need zero typing. */
export async function getFrequentTests(limit = 10): Promise<Test[]> {
  const sql = `SELECT t.*, p.code as panel_code, p.report_heading as panel_heading,
                      (SELECT COUNT(*) FROM orders o WHERE o.test_id=t.id) as freq
               FROM tests t LEFT JOIN panels p ON t.panel_id=p.id
               WHERE t.enabled=1
               ORDER BY freq DESC, t.name
               LIMIT ?`;
  return dbQuery<Test>(sql, [limit]);
}

export async function getTestRanges(testId: number): Promise<TestRange[]> {
  return dbQuery<TestRange>('SELECT * FROM test_ranges WHERE test_id=? ORDER BY sex,age_min_days', [testId]);
}

export async function getTestsByPanel(): Promise<Record<string, Test[]>> {
  const tests = await listTests();
  const map: Record<string, Test[]> = {};
  for (const t of tests) {
    const key = t.panel_code ?? 'MISC';
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return map;
}

export async function upsertTest(test: Partial<Test> & { code: string; name: string }): Promise<void> {
  assertCan('edit_tests');
  // Clamp to safe bounds so bad input can never crash report rendering (toFixed) or
  // produce negative prices that corrupt billing.
  const decimals = Math.min(10, Math.max(0, Math.trunc(Number(test.decimals ?? 1)) || 0));
  const price = Math.max(0, Number(test.price ?? 0) || 0);
  await dbExecute(
    `INSERT INTO tests(code,name,panel_id,result_type,unit,decimals,price,enabled,sort_order,choices,default_value,formula,interpretation_note,is_panel,needs_review)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(code) DO UPDATE SET
       name=excluded.name, panel_id=excluded.panel_id, result_type=excluded.result_type,
       unit=excluded.unit, decimals=excluded.decimals, price=excluded.price, enabled=excluded.enabled,
       sort_order=excluded.sort_order, choices=excluded.choices, default_value=excluded.default_value,
       formula=excluded.formula, interpretation_note=excluded.interpretation_note,
       is_panel=excluded.is_panel, needs_review=excluded.needs_review,
       updated_at=CURRENT_TIMESTAMP`,
    [test.code, test.name, test.panel_id ?? null, test.result_type ?? 'numeric',
     test.unit ?? '', decimals, price, test.enabled ?? 1,
     test.sort_order ?? 0, test.choices ?? null, test.default_value ?? null,
     test.formula ?? null, test.interpretation_note ?? null, test.is_panel ?? 0,
     test.needs_review ?? 0]
  );
}

export async function updateTestPrice(testId: number, price: number): Promise<void> {
  assertCan('edit_prices');
  const before = await dbQuery<{ price: number }>('SELECT price FROM tests WHERE id=?', [testId]);
  await dbExecute('UPDATE tests SET price=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [price, testId]);
  await writeAudit(currentUserId(), 'test.price', 'tests', testId, { price: before[0]?.price }, { price });
}

export async function setTestEnabled(testId: number, enabled: number): Promise<void> {
  assertCan('edit_tests');
  await dbExecute('UPDATE tests SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [enabled, testId]);
  await writeAudit(currentUserId(), 'test.enabled', 'tests', testId, null, { enabled });
}

export async function setInterpretation(testId: number, note: string): Promise<void> {
  assertCan('edit_tests');
  await dbExecute('UPDATE tests SET interpretation_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [note, testId]);
  await writeAudit(currentUserId(), 'test.interpretation', 'tests', testId, null, { note });
}

export async function upsertRange(range: Omit<TestRange, 'id' | 'created_at'>): Promise<void> {
  assertCan('edit_ranges');
  // A low above high silently breaks H/L flagging (every value reads normal) — reject it.
  if (range.low != null && range.high != null && range.low > range.high) {
    throw new Error('Low value cannot be greater than High value.');
  }
  if (range.age_min_days > range.age_max_days) {
    throw new Error('Minimum age cannot be greater than maximum age.');
  }
  await dbExecute(
    `INSERT INTO test_ranges(test_id,sex,age_min_days,age_max_days,low,high,range_text,band_text)
     VALUES(?,?,?,?,?,?,?,?)`,
    [range.test_id, range.sex, range.age_min_days, range.age_max_days,
     range.low ?? null, range.high ?? null, range.range_text ?? null, range.band_text ?? null]
  );
  await writeAudit(currentUserId(), 'range.create', 'test_ranges', range.test_id, null, range);
}

export async function deleteRange(id: number): Promise<void> {
  assertCan('edit_ranges');
  await dbExecute('DELETE FROM test_ranges WHERE id=?', [id]);
  await writeAudit(currentUserId(), 'range.delete', 'test_ranges', id, null, null);
}
