import { dbQuery, dbExecute } from '@/lib/db';
import { Test, TestRange, Panel } from '@/types';

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
  const sql = `SELECT t.*, p.code as panel_code, p.report_heading as panel_heading
               FROM tests t LEFT JOIN panels p ON t.panel_id=p.id
               WHERE t.enabled=1 AND (t.code LIKE ? OR t.name LIKE ?)
               ORDER BY t.code LIMIT 30`;
  return dbQuery<Test>(sql, [`${query}%`, `%${query}%`]);
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
     test.unit ?? '', test.decimals ?? 1, test.price ?? 0, test.enabled ?? 1,
     test.sort_order ?? 0, test.choices ?? null, test.default_value ?? null,
     test.formula ?? null, test.interpretation_note ?? null, test.is_panel ?? 0,
     test.needs_review ?? 0]
  );
}

export async function updateTestPrice(testId: number, price: number): Promise<void> {
  await dbExecute('UPDATE tests SET price=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [price, testId]);
}

export async function setTestEnabled(testId: number, enabled: number): Promise<void> {
  await dbExecute('UPDATE tests SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [enabled, testId]);
}

export async function upsertRange(range: Omit<TestRange, 'id' | 'created_at'>): Promise<void> {
  await dbExecute(
    `INSERT INTO test_ranges(test_id,sex,age_min_days,age_max_days,low,high,range_text,band_text)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT DO NOTHING`,
    [range.test_id, range.sex, range.age_min_days, range.age_max_days,
     range.low ?? null, range.high ?? null, range.range_text ?? null, range.band_text ?? null]
  );
}

export async function deleteRange(id: number): Promise<void> {
  await dbExecute('DELETE FROM test_ranges WHERE id=?', [id]);
}
