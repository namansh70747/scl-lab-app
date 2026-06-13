-- ============================================================
-- SCL Lab App  –  Migration 0009 : tests missing vs the previous app
-- ============================================================
-- Standard tests present in the old software's menu but not yet seeded.

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order)
VALUES
  ('LIPASE', 'Lipase', (SELECT id FROM panels WHERE code='BIO'),  'numeric', 'U/L',   1, 350, 1, 360),
  ('FIBRI',  'Fibrinogen', (SELECT id FROM panels WHERE code='COAG'), 'numeric', 'mg/dL', 0, 300, 1, 60);

INSERT OR IGNORE INTO test_ranges(test_id, sex, age_min_days, age_max_days, low, high, range_text)
SELECT id, 'ANY', 0, 54750, 13, 60, '13 - 60' FROM tests WHERE code='LIPASE';
INSERT OR IGNORE INTO test_ranges(test_id, sex, age_min_days, age_max_days, low, high, range_text)
SELECT id, 'ANY', 0, 54750, 200, 400, '200 - 400' FROM tests WHERE code='FIBRI';
