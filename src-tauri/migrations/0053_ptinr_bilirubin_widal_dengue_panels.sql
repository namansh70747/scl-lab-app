-- 0053_ptinr_bilirubin_widal_dengue_panels
-- ============================================================
-- Ships four panels that were previously hand-built per lab, so every install gets them:
--   1. PROTHROMBIN TIME (PT / INR) — patient PT, control, ISI, ratio, index, INR
--   2. BILIRUBIN (Total / Direct / Indirect) combo, in TWO flavours: one that reports under
--      LIVER FUNCTION TEST (LFT) and one under BIOCHEMISTRY (same BIL1/BIL2 twin convention
--      migration 0049 introduced for the other biochemistry analytes)
--   3. WIDAL SLIDE METHOD — the slide result plus the four agglutinin titres
--   4. DENGUE SEROLOGY — NS1 antigen + IgM + IgG
--
-- Each panel is orderable as ONE billed profile (is_panel=1) that expands into its member rows,
-- exactly like the CBC / DLC / HbA1c / Stool / Semen bundles.
--
-- Safety notes:
--   • Everything is INSERT OR IGNORE or a targeted UPDATE, so it is idempotent and never
--     duplicates a row a lab already created by hand.
--   • The UPDATEs deliberately do NOT touch `name` or `price` — a lab that already built these
--     tests keeps its own wording and pricing; only the wiring (panel, type, formula) is corrected.
--   • No patient, order, result, analyzer/CBC or settings row is read or written here.

-- ============================================================
-- 0. Panel ordering — make room for the four new panels
-- ============================================================
-- Re-spaces the stock panels so each new panel can sit immediately beside the section it belongs
-- to (bilirubin next to BIOCHEMISTRY / LFT, Widal + Dengue next to SEROLOGY, PT/INR next to
-- COAGULATION). Report sections group by department and only merge when panels are adjacent, so
-- the gaps matter. The RELATIVE order of every existing panel is preserved exactly; only the
-- numbers change. Panels a lab created itself are left alone (they are not in the code list).
UPDATE panels SET sort_order = CASE code
    WHEN 'HEM'    THEN 10
    WHEN 'CBC'    THEN 11
    WHEN 'DLCP'   THEN 13
    WHEN 'BIO'    THEN 20
    WHEN 'LFT'    THEN 30
    WHEN 'KFT'    THEN 32
    WHEN 'LIPID'  THEN 33
    WHEN 'ELEC'   THEN 34
    WHEN 'DIAB'   THEN 35
    WHEN 'THY'    THEN 40
    WHEN 'HORM'   THEN 41
    WHEN 'HBA1CP' THEN 42
    WHEN 'SERO'   THEN 50
    WHEN 'SALP'   THEN 51
    WHEN 'COAG'   THEN 60
    WHEN 'URINE'  THEN 70
    WHEN 'STOOL'  THEN 75
    WHEN 'SEMEN'  THEN 76
    WHEN 'FLUID'  THEN 80
    WHEN 'MICRO'  THEN 85
    WHEN 'MISC'   THEN 90
    ELSE sort_order END,
  updated_at = CURRENT_TIMESTAMP
WHERE code IN ('HEM','CBC','DLCP','BIO','LFT','KFT','LIPID','ELEC','DIAB','THY','HORM',
               'HBA1CP','SERO','SALP','COAG','URINE','STOOL','SEMEN','FLUID','MICRO','MISC');

-- ============================================================
-- 1. PROTHROMBIN TIME (PT / INR)
-- ============================================================
-- Mapped to the HAEMATOLOGY department in the report (see DEPARTMENT in ReportPreviewPage), so it
-- prints as its own sub-heading under the same department as COAGULATION.
INSERT OR IGNORE INTO panels(code, name, report_heading, sort_order, page_break_after)
VALUES ('PTI', 'PROTHROMBIN TIME (PT / INR)', 'PROTHROMBIN TIME (PT / INR)', 61, 0);

-- Member lines. Ratio and Index are ordinary stored formulas; INR is a built-in calculation
-- (see BUILTIN_CALC_CODES in src/lib/calc.ts) because it needs the ISI exponent — the stored
-- formula below is the ISI-1.0 equivalent kept only as a readable fallback.
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, formula, default_value) VALUES
  ('PTIT',  'Prothrombin Time', (SELECT id FROM panels WHERE code='PTI'), 'numeric',    'sec', 1, 0, 1, 10, NULL,                 NULL),
  ('PTICT', 'Control',          (SELECT id FROM panels WHERE code='PTI'), 'numeric',    'sec', 1, 0, 1, 20, NULL,                 NULL),
  ('ISI',   'ISI',              (SELECT id FROM panels WHERE code='PTI'), 'numeric',    '',    2, 0, 1, 30, NULL,                 '1.0'),
  ('RATIO', 'Ratio',            (SELECT id FROM panels WHERE code='PTI'), 'calculated', '',    2, 0, 1, 40, 'PTIT / PTICT',       NULL),
  ('INDEX', 'Index',            (SELECT id FROM panels WHERE code='PTI'), 'calculated', '%',   0, 0, 1, 50, 'PTICT / PTIT * 100', NULL);

-- Correct the wiring on installs where these lines were already hand-built (name/price untouched).
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='PTI'),
       result_type='numeric', unit='sec', decimals=1, sort_order=10, formula=NULL, is_panel=0,
       enabled=1, updated_at=CURRENT_TIMESTAMP
 WHERE code='PTIT';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='PTI'),
       result_type='numeric', unit='sec', decimals=1, sort_order=20, formula=NULL, is_panel=0,
       enabled=1, updated_at=CURRENT_TIMESTAMP
 WHERE code='PTICT';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='PTI'),
       result_type='numeric', unit='', decimals=2, sort_order=30, formula=NULL, is_panel=0,
       default_value='1.0', enabled=1, updated_at=CURRENT_TIMESTAMP
 WHERE code='ISI';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='PTI'),
       result_type='calculated', unit='', decimals=2, sort_order=40, formula='PTIT / PTICT',
       is_panel=0, enabled=1, updated_at=CURRENT_TIMESTAMP
 WHERE code='RATIO';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='PTI'),
       result_type='calculated', unit='%', decimals=0, sort_order=50, formula='PTICT / PTIT * 100',
       is_panel=0, enabled=1, updated_at=CURRENT_TIMESTAMP
 WHERE code='INDEX';

-- INR already exists in COAGULATION (seed 0002) with the old fixed-control formula. Move it into
-- the PT/INR panel so the profile expands into a complete PT + control + ISI + INR block, and
-- point its fallback formula at the panel's own lines.
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='PTI'),
       result_type='calculated', unit='', decimals=2, sort_order=60, formula='PTIT / PTICT',
       is_panel=0, enabled=1, updated_at=CURRENT_TIMESTAMP
 WHERE code='INR';

-- Sellable profile → one bill line that expands into the six rows above.
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, is_panel)
SELECT 'PTIP', 'Prothrombin Time (PT / INR)', id, 'text', '', 0, 300, 1, 0, 1 FROM panels WHERE code='PTI';

-- Reference ranges (printed in the report's normal-range column). test_ranges has no unique
-- constraint, so INSERT OR IGNORE cannot dedupe: every insert is guarded on "this test has no
-- range yet". Without that, INR (already given a range by seed 0002) and any line a lab built by
-- hand would end up printing two reference rows.
INSERT INTO test_ranges(test_id, sex, low, high, range_text)
SELECT t.id, 'ANY', 11, 13.5, '11 - 13.5' FROM tests t
 WHERE t.code IN ('PTIT','PTICT') AND NOT EXISTS (SELECT 1 FROM test_ranges r WHERE r.test_id = t.id);
INSERT INTO test_ranges(test_id, sex, low, high, range_text)
SELECT t.id, 'ANY', 0.8, 1.2, '0.8 - 1.2' FROM tests t
 WHERE t.code IN ('RATIO','INR') AND NOT EXISTS (SELECT 1 FROM test_ranges r WHERE r.test_id = t.id);
INSERT INTO test_ranges(test_id, sex, low, high, range_text)
SELECT t.id, 'ANY', 70, 100, '70 - 100' FROM tests t
 WHERE t.code = 'INDEX' AND NOT EXISTS (SELECT 1 FROM test_ranges r WHERE r.test_id = t.id);

-- ============================================================
-- 2. BILIRUBIN (TOTAL, DIRECT & INDIRECT) — two report flavours
-- ============================================================
-- Same three analytes twice, so the lab can print the combo under either heading:
--   BILI1 → reports under LIVER FUNCTION TEST (LFT)
--   BILI2 → reports under BIOCHEMISTRY
-- The existing LFT (BBT/BBD/BBI) and BIOCHEMISTRY (BBT1/BBD1/BBI1) rows are left untouched; these
-- are standalone profiles for when only a bilirubin is requested.
INSERT OR IGNORE INTO panels(code, name, report_heading, sort_order, page_break_after) VALUES
  ('BILI2', 'BILIRUBIN (BIOCHEMISTRY)', 'BILIRUBIN (TOTAL, DIRECT & INDIRECT)', 21, 0),
  ('BILI1', 'BILIRUBIN (LFT)',          'BILIRUBIN (TOTAL, DIRECT & INDIRECT)', 31, 0);

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, formula) VALUES
  ('BIL1_T', 'Bilirubin Total',    (SELECT id FROM panels WHERE code='BILI1'), 'numeric',    'mg/dL', 2, 0, 1, 10, NULL),
  ('BIL1_D', 'Bilirubin Direct',   (SELECT id FROM panels WHERE code='BILI1'), 'numeric',    'mg/dL', 2, 0, 1, 20, NULL),
  ('BIL1_I', 'Bilirubin Indirect', (SELECT id FROM panels WHERE code='BILI1'), 'calculated', 'mg/dL', 2, 0, 1, 30, 'BIL1_T - BIL1_D'),
  ('BIL2_T', 'Bilirubin Total',    (SELECT id FROM panels WHERE code='BILI2'), 'numeric',    'mg/dL', 2, 0, 1, 10, NULL),
  ('BIL2_D', 'Bilirubin Direct',   (SELECT id FROM panels WHERE code='BILI2'), 'numeric',    'mg/dL', 2, 0, 1, 20, NULL),
  ('BIL2_I', 'Bilirubin Indirect', (SELECT id FROM panels WHERE code='BILI2'), 'calculated', 'mg/dL', 2, 0, 1, 30, 'BIL2_T - BIL2_D');

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, is_panel)
SELECT 'BIL1', 'Bilirubin (Total, Direct & Indirect)', id, 'text', '', 0, 150, 1, 0, 1 FROM panels WHERE code='BILI1';
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, is_panel)
SELECT 'BIL2', 'Bilirubin (Total, Direct & Indirect)', id, 'text', '', 0, 150, 1, 0, 1 FROM panels WHERE code='BILI2';

-- Ranges mirror the existing bilirubin rows in the seed (same no-duplicate guard as above).
INSERT INTO test_ranges(test_id, sex, low, high, range_text)
SELECT t.id, 'ANY', 0.30, 1.20, '0.30 - 1.20' FROM tests t
 WHERE t.code IN ('BIL1_T','BIL2_T') AND NOT EXISTS (SELECT 1 FROM test_ranges r WHERE r.test_id = t.id);
INSERT INTO test_ranges(test_id, sex, high, range_text)
SELECT t.id, 'ANY', 0.30, '< 0.30' FROM tests t
 WHERE t.code IN ('BIL1_D','BIL2_D') AND NOT EXISTS (SELECT 1 FROM test_ranges r WHERE r.test_id = t.id);
INSERT INTO test_ranges(test_id, sex, low, high, range_text)
SELECT t.id, 'ANY', 0.00, 0.80, '0.00 - 0.80' FROM tests t
 WHERE t.code IN ('BIL1_I','BIL2_I') AND NOT EXISTS (SELECT 1 FROM test_ranges r WHERE r.test_id = t.id);

-- ============================================================
-- 3. WIDAL SLIDE METHOD
-- ============================================================
-- The four agglutinin titres already exist in SEROLOGY (migration 0030); they move into their own
-- panel so the slide profile expands to exactly these rows and prints under its own sub-heading.
INSERT OR IGNORE INTO panels(code, name, report_heading, sort_order, page_break_after)
VALUES ('WIDALP', 'WIDAL SLIDE METHOD', 'WIDAL SLIDE METHOD', 52, 0);

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, choices) VALUES
  ('WIDAL_SLIDE', 'Widal Slide Method', (SELECT id FROM panels WHERE code='WIDALP'), 'choice', '—', 0, 0, 1, 10, '["Negative","Positive"]');

UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='WIDALP'), sort_order=20, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='WIDAL_TO';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='WIDALP'), sort_order=30, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='WIDAL_TH';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='WIDALP'), sort_order=40, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='WIDAL_PAH';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='WIDALP'), sort_order=50, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='WIDAL_PBH';

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, is_panel)
SELECT 'WIDALSP', 'Widal Test (Slide Method)', id, 'text', '', 0, 150, 1, 0, 1 FROM panels WHERE code='WIDALP';

-- Retire the old single free-text "Widal Test" from NEW order search so the profile above is the
-- one that gets picked (same treatment migration 0052 gave the flat stool test). Reports and
-- results for patients already carrying it are unaffected, and it can be switched back on from
-- Test Master at any time.
UPDATE tests SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE code = 'WIDAL';

-- ============================================================
-- 4. DENGUE SEROLOGY
-- ============================================================
-- NS1 / IgM / IgG already exist in SEROLOGY with their interpretation notes (migrations 0021,
-- 0029); they move into a dedicated panel so all three can be ordered as one profile.
INSERT OR IGNORE INTO panels(code, name, report_heading, sort_order, page_break_after)
VALUES ('DENGP', 'DENGUE SEROLOGY', 'DENGUE SEROLOGY', 53, 0);

UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='DENGP'), sort_order=10, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='NS1';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='DENGP'), sort_order=20, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='DENGIGM';
UPDATE tests SET panel_id = (SELECT id FROM panels WHERE code='DENGP'), sort_order=30, enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code='DENGIGG';

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, is_panel)
SELECT 'DENGPP', 'Dengue Serology (NS1 + IgM + IgG)', id, 'text', '', 0, 900, 1, 0, 1 FROM panels WHERE code='DENGP';

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0053');
