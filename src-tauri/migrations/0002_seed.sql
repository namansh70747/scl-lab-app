-- ============================================================
-- SCL Lab App  –  Migration 0002 : Seed Data
-- ============================================================

-- ============================================================
-- Panels
-- ============================================================
INSERT OR IGNORE INTO panels(code, name, report_heading, sort_order, page_break_after) VALUES
    ('HEM',   'HEMATOLOGY',                        'HEMATOLOGY',                        10,  0),
    ('CBC',   'COMPLETE BLOOD COUNT (CBC)',         'COMPLETE BLOOD COUNT (CBC)',         11,  1),
    ('BIO',   'BIOCHEMISTRY',                       'BIOCHEMISTRY',                       20,  0),
    ('LFT',   'LIVER FUNCTION TEST (LFT)',          'LIVER FUNCTION TEST (LFT)',          21,  0),
    ('KFT',   'RENAL FUNCTION TEST (RFT/KFT)',      'RENAL FUNCTION TEST (RFT/KFT)',      22,  0),
    ('LIPID', 'LIPID PROFILE',                      'LIPID PROFILE',                      23,  0),
    ('ELEC',  'ELECTROLYTES',                       'ELECTROLYTES',                       24,  0),
    ('DIAB',  'DIABETIC PROFILE',                   'DIABETIC PROFILE',                   25,  0),
    ('THY',   'THYROID PROFILE',                    'THYROID PROFILE',                    30,  0),
    ('HORM',  'HORMONES',                           'HORMONES',                           31,  0),
    ('SERO',  'SEROLOGY',                           'SEROLOGY',                           40,  0),
    ('COAG',  'COAGULATION',                        'COAGULATION',                        45,  0),
    ('URINE', 'URINE EXAMINATION',                  'URINE EXAMINATION',                  50,  1),
    ('STOOL', 'STOOL EXAMINATION',                  'STOOL EXAMINATION',                  55,  0),
    ('FLUID', 'BODY FLUID',                         'BODY FLUID',                         60,  0),
    ('MICRO', 'MICROBIOLOGY',                       'MICROBIOLOGY',                       65,  0),
    ('MISC',  'MISCELLANEOUS',                      'MISCELLANEOUS',                      90,  0);

-- ============================================================
-- Tests
-- ============================================================

-- ── HEMATOLOGY ───────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, choices, default_value, formula, interpretation_note, needs_review) VALUES
    ('HB',    'Haemoglobin',           (SELECT id FROM panels WHERE code='HEM'), 'numeric',  'gm/dl',  1, 30,  1, 10,  NULL, NULL, NULL, NULL, 0),
    ('TLC',   'Total Leucocyte Count', (SELECT id FROM panels WHERE code='HEM'), 'numeric',  '/cumm',  0, 30,  1, 20,  NULL, NULL, NULL, NULL, 0),
    ('DLC',   'Differential Leucocyte Count', (SELECT id FROM panels WHERE code='HEM'), 'text', '%', 0, 40,  1, 30,  NULL, NULL, NULL, NULL, 0),
    ('PLT',   'Platelet Count',        (SELECT id FROM panels WHERE code='HEM'), 'numeric',  '/cumm',  0, 100, 1, 40,  NULL, NULL, NULL, NULL, 0),
    ('ESR',   'Erythrocyte Sedimentation Rate', (SELECT id FROM panels WHERE code='HEM'), 'numeric', 'mm/hr', 0, 50, 1, 50, NULL, NULL, NULL, NULL, 0),
    ('AEC',   'Absolute Eosinophil Count', (SELECT id FROM panels WHERE code='HEM'), 'numeric', '/cumm', 0, 150, 1, 60, NULL, NULL, NULL, NULL, 0),
    ('PCV',   'Packed Cell Volume',    (SELECT id FROM panels WHERE code='HEM'), 'numeric',  '%',      1, 0,   1, 70,  NULL, NULL, NULL, NULL, 0),
    ('PBF',   'Peripheral Blood Film', (SELECT id FROM panels WHERE code='HEM'), 'text',     '—',      0, 150, 1, 80,  NULL, NULL, NULL, NULL, 1),
    ('ABO',   'Blood Group & Rh Type', (SELECT id FROM panels WHERE code='HEM'), 'choice',   '—',      0, 30,  1, 90,  '["A+","A-","B+","B-","AB+","AB-","O+","O-"]', NULL, NULL, NULL, 0),
    ('BT',    'Bleeding Time',         (SELECT id FROM panels WHERE code='HEM'), 'numeric',  'min',    1, 20,  1, 100, NULL, NULL, NULL, NULL, 0),
    ('CT',    'Clotting Time',         (SELECT id FROM panels WHERE code='HEM'), 'numeric',  'min',    1, 20,  1, 110, NULL, NULL, NULL, NULL, 0);

-- ── CBC (Complete Blood Count sub-parameters) ────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('WBC',     'WBC',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^3/µL', 2, 0,   1, 1),
    ('LYM_PCT', 'LYM%',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 2),
    ('MID_PCT', 'MID%',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 3),
    ('GRAN_PCT','GRA%',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 4),
    ('LYM_NUM', 'LYM#',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^3/µL', 2, 0,   1, 5),
    ('MID_NUM', 'MID#',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^3/µL', 2, 0,   1, 6),
    ('GRAN_NUM','GRA#',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^3/µL', 2, 0,   1, 7),
    ('RBC_CNT', 'RBC',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^6/µL', 2, 0,   1, 8),
    ('HGB',     'HGB',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'g/dL',    1, 0,   1, 9),
    ('HCT',     'HCT',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 10),
    ('MCV',     'MCV',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'fL',      1, 0,   1, 11),
    ('MCH',     'MCH',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'pg',      1, 0,   1, 12),
    ('MCHC',    'MCHC',                  (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'g/dL',    1, 0,   1, 13),
    ('RDW_SD',  'RDW-SD',                (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'fL',      1, 0,   1, 14),
    ('RDW_CV',  'RDW-CV',                (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 15),
    ('PLT_CBC', 'PLT',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^3/µL', 0, 0,   1, 16),
    ('MPV',     'MPV',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'fL',      1, 0,   1, 17),
    ('PCT_CBC', 'PCT',                   (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       3, 0,   1, 18),
    ('PDW_SD',  'PDW-SD',                (SELECT id FROM panels WHERE code='CBC'), 'numeric', 'fL',      1, 0,   1, 19),
    ('PDW_CV',  'PDW-CV',                (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 20),
    ('PLCR',    'P-LCR',                 (SELECT id FROM panels WHERE code='CBC'), 'numeric', '%',       1, 0,   1, 21),
    ('PLCC',    'P-LCC',                 (SELECT id FROM panels WHERE code='CBC'), 'numeric', '10^3/µL', 2, 0,   1, 22);

-- ── BIOCHEMISTRY (misc) ──────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, needs_review) VALUES
    ('CPKM',  'CPK-MB',                       (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'U/L',    0, 600, 1, 10, 0),
    ('CPKN',  'CPK-NAC (Total)',               (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'U/L',    0, 450, 1, 20, 0),
    ('LDH1',  'LDH',                           (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'U/L',    0, 300, 1, 30, 0),
    ('ACP',   'Acid Phosphatase',              (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'U/L',    1, 350, 1, 40, 0),
    ('LPA',   'Lp(a)',                         (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'mg/dL',  1, 400, 1, 50, 0),
    ('AMY',   'Amylase',                       (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'U/L',    0, 400, 1, 60, 0),
    ('IRON',  'Serum Iron',                    (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'µg/dL',  1, 200, 1, 70, 0),
    ('TIBC',  'TIBC',                          (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'µg/dL',  1, 450, 1, 80, 0),
    ('FOL',   'Folic Acid',                    (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'ng/mL',  2, 800, 1, 90, 0),
    ('G6QT',  'G6PD Quantitative',             (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'U/gHb',  1, 260, 1, 100, 0),
    ('OCB',   'Occult Blood',                  (SELECT id FROM panels WHERE code='BIO'), 'choice',  '—',      0, 100, 1, 110, 0),
    ('AMM',   'Ammonia',                       (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'µmol/L', 1, 700, 1, 120, 0),
    ('VTB',   'Vitamin B12',                   (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'pg/mL',  1, 900, 1, 130, 0),
    ('VITD',  'Vitamin D (25-OH)',             (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'ng/mL',  2, 700, 1, 140, 0),
    ('FER',   'Ferritin',                      (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'ng/mL',  2, 600, 1, 150, 0),
    ('HSCRP', 'hs-CRP',                        (SELECT id FROM panels WHERE code='BIO'), 'numeric', 'mg/L',   2, 550, 1, 160, 0);

INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, choices) VALUES
    ('OCB',   'Occult Blood', (SELECT id FROM panels WHERE code='BIO'), 'choice', '—', 0, 100, 1, 110, '["Negative","Positive"]');

-- ── LFT ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, formula) VALUES
    ('BBT',    'Bilirubin Total',           (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'mg/dL', 2, 50,  1, 10,  NULL),
    ('BBD',    'Bilirubin Direct',          (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'mg/dL', 2, 0,   1, 20,  NULL),
    ('BBI',    'Bilirubin Indirect',        (SELECT id FROM panels WHERE code='LFT'), 'calculated', 'mg/dL', 2, 0,   1, 30,  'BBT - BBD'),
    ('OT',     'SGOT (AST)',                (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'U/L',   0, 50,  1, 40,  NULL),
    ('PT_ALT', 'SGPT (ALT)',                (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'U/L',   0, 50,  1, 50,  NULL),
    ('ALP',    'Alkaline Phosphatase',      (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'U/L',   1, 180, 1, 60,  NULL),
    ('BGGT',   'GGTP',                      (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'U/L',   2, 200, 1, 70,  NULL),
    ('TPN',    'Total Protein',             (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'g/dL',  2, 100, 1, 80,  NULL),
    ('ALB',    'Albumin',                   (SELECT id FROM panels WHERE code='LFT'), 'numeric',    'g/dL',  2, 100, 1, 90,  NULL),
    ('GLO',    'Globulin',                  (SELECT id FROM panels WHERE code='LFT'), 'calculated', 'g/dL',  2, 100, 1, 100, 'TPN - ALB'),
    ('BAG',    'A/G Ratio',                 (SELECT id FROM panels WHERE code='LFT'), 'calculated', '',      2, 0,   1, 110, 'ALB / GLO');

-- ── KFT ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, formula) VALUES
    ('UREA',  'Blood Urea',               (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  1, 50,  1, 10,  NULL),
    ('BUN',   'Blood Urea Nitrogen',      (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  1, 50,  1, 20,  NULL),
    ('CRT',   'Serum Creatinine',         (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  2, 50,  1, 30,  NULL),
    ('UA',    'Uric Acid',                (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  1, 50,  1, 40,  NULL),
    ('CAL',   'Calcium',                  (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  1, 100, 1, 50,  NULL),
    ('BCALI', 'Ionized Calcium',          (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mmol/L', 2, 50,  1, 60,  NULL),
    ('PHO',   'Phosphorus',               (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  1, 200, 1, 70,  NULL),
    ('MAG',   'Magnesium',                (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/dL',  1, 500, 1, 80,  NULL),
    ('LIT',   'Lithium',                  (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mEq/L',  2, 500, 1, 90,  NULL),
    ('MAU',   'Microalbumin (Urine)',     (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mg/L',   1, 400, 1, 100, NULL),
    ('BC',    'Bicarbonate',              (SELECT id FROM panels WHERE code='KFT'), 'numeric',    'mmol/L', 1, 450, 1, 110, NULL),
    ('GFR',   'eGFR (CKD-EPI)',          (SELECT id FROM panels WHERE code='KFT'), 'calculated', 'mL/min/1.73m²', 1, 50, 1, 120, 'CKD-EPI');

-- ── LIPID ────────────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, formula) VALUES
    ('CHOL',  'Total Cholesterol',         (SELECT id FROM panels WHERE code='LIPID'), 'numeric',    'mg/dL', 1, 50,  1, 10, NULL),
    ('TG',    'Triglycerides',             (SELECT id FROM panels WHERE code='LIPID'), 'numeric',    'mg/dL', 1, 150, 1, 20, NULL),
    ('BHDL',  'HDL Cholesterol',           (SELECT id FROM panels WHERE code='LIPID'), 'numeric',    'mg/dL', 1, 150, 1, 30, NULL),
    ('BLDL',  'LDL Cholesterol',           (SELECT id FROM panels WHERE code='LIPID'), 'numeric',    'mg/dL', 1, 100, 1, 40, NULL),
    ('BVLDL', 'VLDL Cholesterol',          (SELECT id FROM panels WHERE code='LIPID'), 'calculated', 'mg/dL', 1, 100, 1, 50, 'TG / 5'),
    ('BRAT',  'Total Chol / HDL Ratio',   (SELECT id FROM panels WHERE code='LIPID'), 'calculated', '',      2, 0,   1, 60, 'CHOL / BHDL'),
    ('BLHR',  'LDL / HDL Ratio',          (SELECT id FROM panels WHERE code='LIPID'), 'calculated', '',      2, 0,   1, 70, 'BLDL / BHDL'),
    ('NHDL',  'Non-HDL Cholesterol',       (SELECT id FROM panels WHERE code='LIPID'), 'calculated', 'mg/dL', 1, 0,   1, 80, 'CHOL - BHDL');

-- ── ELECTROLYTES ─────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('NA',  'Sodium',    (SELECT id FROM panels WHERE code='ELEC'), 'numeric', 'mEq/L', 1, 100, 1, 10),
    ('K',   'Potassium', (SELECT id FROM panels WHERE code='ELEC'), 'numeric', 'mEq/L', 1, 100, 1, 20),
    ('CL',  'Chloride',  (SELECT id FROM panels WHERE code='ELEC'), 'numeric', 'mEq/L', 1, 100, 1, 30);

-- ── DIABETIC PROFILE ─────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, formula) VALUES
    ('FBS',   'Fasting Blood Sugar',          (SELECT id FROM panels WHERE code='DIAB'), 'numeric',    'mg/dL', 0, 20,  1, 10, NULL),
    ('RBS',   'Random Blood Sugar',           (SELECT id FROM panels WHERE code='DIAB'), 'numeric',    'mg/dL', 0, 20,  1, 20, NULL),
    ('PPBS',  'Post Prandial Blood Sugar',    (SELECT id FROM panels WHERE code='DIAB'), 'numeric',    'mg/dL', 0, 20,  1, 30, NULL),
    ('HBA1C', 'Glycated Haemoglobin (HbA1c)', (SELECT id FROM panels WHERE code='DIAB'), 'numeric',   '%',     1, 350, 1, 40, NULL),
    ('EAG',   'Estimated Average Glucose',   (SELECT id FROM panels WHERE code='DIAB'), 'calculated', 'mg/dL', 1, 0,   1, 50, '28.7 * HBA1C - 46.7');

-- ── THYROID ──────────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('TSH', 'TSH (Thyroid Stimulating Hormone)', (SELECT id FROM panels WHERE code='THY'), 'numeric', 'µIU/mL', 3, 200, 1, 10),
    ('T3',  'T3 (Triiodothyronine)',              (SELECT id FROM panels WHERE code='THY'), 'numeric', 'ng/dL',  2, 250, 1, 20),
    ('T4',  'T4 (Thyroxine)',                     (SELECT id FROM panels WHERE code='THY'), 'numeric', 'µg/dL',  2, 250, 1, 30),
    ('FT3', 'Free T3',                            (SELECT id FROM panels WHERE code='THY'), 'numeric', 'pg/mL',  2, 250, 1, 40),
    ('FT4', 'Free T4',                            (SELECT id FROM panels WHERE code='THY'), 'numeric', 'ng/dL',  2, 300, 1, 50);

-- ── HORMONES ─────────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('LH',     'LH (Luteinizing Hormone)',           (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'mIU/mL', 2, 450,  1, 10),
    ('FSH',    'FSH (Follicle Stimulating Hormone)', (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'mIU/mL', 2, 450,  1, 20),
    ('PRL',    'Prolactin',                          (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'ng/mL',  2, 490,  1, 30),
    ('PROG',   'Progesterone',                       (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'ng/mL',  2, 500,  1, 40),
    ('TESTO',  'Testosterone',                       (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'ng/dL',  2, 550,  1, 50),
    ('E2',     'Estradiol (E2)',                     (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'pg/mL',  2, 500,  1, 60),
    ('AMH',    'Anti-Mullerian Hormone',             (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'ng/mL',  2, 1850, 1, 70),
    ('DHEA',   'DHEA-S',                             (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'µg/dL',  2, 800,  1, 80),
    ('INS',    'Insulin (Fasting)',                  (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'µIU/mL', 2, 550,  1, 90),
    ('INSPP',  'Insulin (Post Prandial)',             (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'µIU/mL', 2, 550,  1, 100),
    ('CORT',   'Cortisol',                           (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'µg/dL',  2, 750,  1, 110),
    ('HGH',    'Growth Hormone (HGH)',               (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'ng/mL',  2, 600,  1, 120),
    ('BETA',   'Beta-hCG',                           (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'mIU/mL', 2, 600,  1, 130),
    ('PTH',    'Parathyroid Hormone (PTH)',           (SELECT id FROM panels WHERE code='HORM'), 'numeric', 'pg/mL',  1, 1000, 1, 140);

-- ── SEROLOGY ─────────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, choices) VALUES
    ('WIDAL',  'Widal Test',                      (SELECT id FROM panels WHERE code='SERO'), 'text',   '—',    0, 50,   1, 10,  NULL),
    ('CRP',    'C-Reactive Protein',              (SELECT id FROM panels WHERE code='SERO'), 'numeric','mg/L', 1, 200,  1, 20,  NULL),
    ('ASO',    'ASO Titre',                       (SELECT id FROM panels WHERE code='SERO'), 'numeric','IU/mL',0, 200,  1, 30,  NULL),
    ('RA',     'RA Factor',                       (SELECT id FROM panels WHERE code='SERO'), 'numeric','IU/mL',0, 450,  1, 40,  NULL),
    ('HBSAG',  'HBsAg (Hepatitis B Surface Ag)',  (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 100,  1, 50,  '["Non-Reactive","Reactive"]'),
    ('HCV',    'Anti-HCV (Hepatitis C)',          (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 400,  1, 60,  '["Non-Reactive","Reactive"]'),
    ('HIV',    'HIV 1 & 2 (Rapid)',               (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 250,  1, 70,  '["Non-Reactive","Reactive"]'),
    ('VDRL',   'VDRL',                            (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 100,  1, 80,  '["Non-Reactive","Reactive"]'),
    ('MPA',    'Malaria Antigen (P.f & P.v)',     (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 100,  1, 90,  '["Negative","P.falciparum","P.vivax","Both"]'),
    ('NS1',    'NS1 Antigen (Dengue)',            (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 450,  1, 100, '["Non-Reactive","Reactive"]'),
    ('TYPHI',  'Typhoid IgM/IgG',                (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 300,  1, 110, '["Negative","IgM Positive","IgG Positive","Both Positive"]'),
    ('PSA',    'PSA (Prostate Specific Antigen)', (SELECT id FROM panels WHERE code='SERO'), 'numeric','ng/mL',2, 650,  1, 120, NULL),
    ('CEA',    'CEA',                             (SELECT id FROM panels WHERE code='SERO'), 'numeric','ng/mL',2, 750,  1, 130, NULL),
    ('AFP',    'AFP (Alpha-Feto Protein)',         (SELECT id FROM panels WHERE code='SERO'), 'numeric','IU/mL',2, 850,  1, 140, NULL),
    ('CA125',  'CA-125',                          (SELECT id FROM panels WHERE code='SERO'), 'numeric','U/mL', 2, 1000, 1, 150, NULL),
    ('CA199',  'CA 19-9',                         (SELECT id FROM panels WHERE code='SERO'), 'numeric','U/mL', 2, 1000, 1, 160, NULL),
    ('CA153',  'CA 15-3',                         (SELECT id FROM panels WHERE code='SERO'), 'numeric','U/mL', 2, 900,  1, 170, NULL),
    ('UPT',    'Urine Pregnancy Test (UPT)',      (SELECT id FROM panels WHERE code='SERO'), 'choice', '—',   0, 30,   1, 180, '["Negative","Positive"]');

-- ── COAGULATION ──────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, choices) VALUES
    ('PT_PT',  'Prothrombin Time (PT)',   (SELECT id FROM panels WHERE code='COAG'), 'numeric', 'sec',  1, 200, 1, 10, NULL),
    ('APTT',   'APTT',                   (SELECT id FROM panels WHERE code='COAG'), 'numeric', 'sec',  1, 350, 1, 20, NULL),
    ('DDIMER', 'D-Dimer',                (SELECT id FROM panels WHERE code='COAG'), 'numeric', 'µg/mL FEU', 2, 900, 1, 30, NULL),
    ('TROP',   'Troponin I (Rapid)',     (SELECT id FROM panels WHERE code='COAG'), 'choice',  '—',   0, 900, 1, 40, '["Negative","Positive"]');

-- ── URINE EXAMINATION ────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order, choices, default_value) VALUES
    ('U_COLOUR',   'Colour',           (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 10, '["Pale Yellow","Yellow","Amber","Dark Yellow","Colourless","Brown","Red","Orange"]', 'Yellow'),
    ('U_APP',      'Appearance',       (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 20, '["Clear","Slightly Turbid","Turbid","Hazy"]', 'Clear'),
    ('U_REACT',    'Reaction (pH)',    (SELECT id FROM panels WHERE code='URINE'), 'numeric', '',   1, 0, 1, 30, NULL, NULL),
    ('U_SG',       'Specific Gravity', (SELECT id FROM panels WHERE code='URINE'), 'numeric', '',   3, 0, 1, 40, NULL, NULL),
    ('U_PROTEIN',  'Protein',          (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 50, '["Nil","Trace","+","++","+++","Positive","Negative"]', 'Nil'),
    ('U_GLUCOSE',  'Glucose',          (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 60, '["Nil","Trace","+","++","+++","Positive","Negative"]', 'Nil'),
    ('U_KETONE',   'Ketone Bodies',    (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 70, '["Nil","Trace","+","++","+++","Positive","Negative"]', 'Nil'),
    ('U_BLOOD',    'Blood',            (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 80, '["Nil","Trace","+","++","+++","Positive","Negative"]', 'Nil'),
    ('U_BILE_S',   'Bile Salts',       (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 90, '["Nil","Present","Absent"]', 'Nil'),
    ('U_BILE_P',   'Bile Pigments',    (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 100,'["Nil","Present","Absent"]', 'Nil'),
    ('U_URO',      'Urobilinogen',     (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 110,'["Normal","Increased","Decreased"]', 'Normal'),
    ('U_NITRITE',  'Nitrite',          (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 120,'["Negative","Positive"]', 'Negative'),
    ('U_PUS',      'Pus Cells',        (SELECT id FROM panels WHERE code='URINE'), 'numeric', '/hpf',0, 0, 1, 130, NULL, NULL),
    ('U_RBC',      'RBCs',             (SELECT id FROM panels WHERE code='URINE'), 'numeric', '/hpf',0, 0, 1, 140, NULL, NULL),
    ('U_EPIT',     'Epithelial Cells', (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 150,'["Nil","Few","Moderate","Many"]', 'Nil'),
    ('U_CAST',     'Casts',            (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 160,'["Nil","Hyaline","Granular","RBC Cast","WBC Cast","Waxy"]', 'Nil'),
    ('U_CRYSTAL',  'Crystals',         (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 170,'["Nil","Uric Acid","Calcium Oxalate","Triple Phosphate","Amorphous Urates","Calcium Carbonate"]', 'Nil'),
    ('U_BACTERIA', 'Bacteria',         (SELECT id FROM panels WHERE code='URINE'), 'choice',  '—',  0, 0, 1, 180,'["Nil","Few","Moderate","Plenty"]', 'Nil');

-- ── STOOL EXAMINATION ────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('STOOL_EXAM', 'Stool Examination', (SELECT id FROM panels WHERE code='STOOL'), 'text', '—', 0, 50, 1, 10);

-- ── BODY FLUID ───────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('SEMEN', 'Semen Analysis', (SELECT id FROM panels WHERE code='FLUID'), 'text', '—', 0, 300, 1, 10);

-- ── MICROBIOLOGY ─────────────────────────────────────────────
INSERT OR IGNORE INTO tests(code, name, panel_id, result_type, unit, decimals, price, enabled, sort_order) VALUES
    ('BLOOD_CULT',  'Blood Culture & Sensitivity',   (SELECT id FROM panels WHERE code='MICRO'), 'text', '—', 0, 900, 1, 10),
    ('URINE_CULT',  'Urine Culture & Sensitivity',   (SELECT id FROM panels WHERE code='MICRO'), 'text', '—', 0, 400, 1, 20),
    ('PUS_CULT',    'Pus Culture & Sensitivity',     (SELECT id FROM panels WHERE code='MICRO'), 'text', '—', 0, 250, 1, 30),
    ('SPUTUM_CULT', 'Sputum Culture & Sensitivity',  (SELECT id FROM panels WHERE code='MICRO'), 'text', '—', 0, 100, 1, 40),
    ('AFB',         'AFB Staining',                  (SELECT id FROM panels WHERE code='MICRO'), 'text', '—', 0, 100, 1, 50),
    ('GRAM',        'Gram Staining',                 (SELECT id FROM panels WHERE code='MICRO'), 'text', '—', 0, 80,  1, 60);

-- ============================================================
-- Test Ranges
-- ============================================================

-- HB (Haemoglobin)
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='HB'), 'M', 13.5, 17.5),
    ((SELECT id FROM tests WHERE code='HB'), 'F', 12.0, 16.0);

-- TLC
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='TLC'), 'ANY', 4000, 11000, '4,000 - 11,000');

-- PLT
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='PLT'), 'ANY', 150000, 450000, '1,50,000 - 4,50,000');

-- FBS
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='FBS'), 'ANY', 70, 110, '70 - 110');

-- RBS
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='RBS'), 'ANY', 70, 150, '70.0 - 150.0');

-- PPBS
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='PPBS'), 'ANY', 70, 140);

-- Serum Creatinine
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='CRT'), 'ANY', 0.60, 1.20, '0.60 - 1.20');

-- Urea
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='UREA'), 'ANY', 15, 45);

-- BUN
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='BUN'), 'ANY', 7, 20);

-- Uric Acid (sex-specific)
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='UA'), 'M', 3.5, 7.2),
    ((SELECT id FROM tests WHERE code='UA'), 'F', 2.6, 6.0);

-- Sodium
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='NA'), 'ANY', 135, 145);

-- Potassium
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='K'), 'ANY', 3.5, 5.1);

-- Chloride
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='CL'), 'ANY', 98, 107);

-- Calcium
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='CAL'), 'ANY', 8.5, 10.5);

-- Phosphorus
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='PHO'), 'ANY', 2.5, 4.5);

-- Magnesium
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high) VALUES
    ((SELECT id FROM tests WHERE code='MAG'), 'ANY', 1.7, 2.2);

-- Bilirubin Total
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='BBT'), 'ANY', 0.30, 1.20, '0.30 - 1.20');

-- Bilirubin Direct
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='BBD'), 'ANY', 0.30, '< 0.30');

-- Bilirubin Indirect
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='BBI'), 'ANY', 0.00, 0.80, '0.00 - 0.80');

-- SGOT
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='OT'), 'ANY', 40, '< 40');

-- SGPT
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='PT_ALT'), 'ANY', 40, '< 40');

-- ALP
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='ALP'), 'ANY', 108, 306, '108.0 - 306.0');

-- GGTP
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='BGGT'), 'ANY', 10, 50, '10.0 - 50.00');

-- Total Protein
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='TPN'), 'ANY', 6.4, 8.3, '6.40 - 8.30');

-- Albumin
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='ALB'), 'ANY', 3.5, 5.2, '3.50 - 5.20');

-- Globulin
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='GLO'), 'ANY', 1.9, 3.7, '1.9 - 3.7');

-- A/G Ratio
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='BAG'), 'ANY', 0.9, 2.0, '0.90 - 2.00');

-- Cholesterol
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, band_text) VALUES
    ((SELECT id FROM tests WHERE code='CHOL'), 'ANY', 200, 'Normal <200 / Borderline 200-239 / High ≥240');

-- Triglycerides
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, band_text) VALUES
    ((SELECT id FROM tests WHERE code='TG'), 'ANY', 150, 'Normal <150 / Borderline 150-199 / High 200-499');

-- HDL
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, band_text) VALUES
    ((SELECT id FROM tests WHERE code='BHDL'), 'ANY', 40, 60, 'Low <40 / Normal 40-60 / High >60');

-- LDL
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, band_text) VALUES
    ((SELECT id FROM tests WHERE code='BLDL'), 'ANY', 130, 'Optimal <100 / Near optimal 100-129 / Borderline 130-159 / High ≥160');

-- Urine pH
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='U_REACT'), 'ANY', 4.5, 8.0, '4.5 - 8.0');

-- Urine SG
INSERT OR IGNORE INTO test_ranges(test_id, sex, low, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='U_SG'), 'ANY', 1.010, 1.030, '1.010 - 1.030');

-- Pus Cells
INSERT OR IGNORE INTO test_ranges(test_id, sex, high, range_text) VALUES
    ((SELECT id FROM tests WHERE code='U_PUS'), 'ANY', 5, '0 - 5 /hpf');

-- ============================================================
-- Doctors
-- ============================================================
INSERT OR IGNORE INTO doctors(name) VALUES
    ('DR VARINDER MAHAJAN'),
    ('DR RAKESH SHARMA'),
    ('DR JOGINDER MAHAJAN'),
    ('DR AMIT GUPTA'),
    ('DR MOHIT MAHAJAN'),
    ('DR ASHWANI'),
    ('DR BALBIR'),
    ('DR DHANJEET'),
    ('DR JEEVAN'),
    ('DR KARANDEEP SINGH'),
    ('DR KEVAL KRISHAN'),
    ('DR LAL CHAND'),
    ('DR MOHAN'),
    ('DR MUKESH'),
    ('DR NARINDER'),
    ('DR NATHA RAM'),
    ('DR PARVEEN KUMAR'),
    ('DR PAWAN'),
    ('DR RAJ KUMAR'),
    ('AJAY'),
    ('SELF');

-- ============================================================
-- Users
-- ============================================================
INSERT OR IGNORE INTO users(username, display_name, role, password_hash, force_password_change) VALUES
    ('admin', 'Administrator', 'admin', '$argon2id$placeholder$changeme', 1);

-- ============================================================
-- Settings
-- ============================================================
INSERT OR IGNORE INTO settings(key, value) VALUES
    ('lab_name',            'SHARMA CLINICAL LABORATORY'),
    ('address_line',        'G.T. Road, Village Nangal Bhur, Teh. & Distt. Pathankot'),
    ('phones',              'Mob: 9646778583 / 9464148746'),
    ('timings',             'Summer: 7:30 am to 9:00 pm | Winter: 8:15 am to 7:30 pm'),
    ('technician_name',     'Rajesh Kumar (Vicky)'),
    ('technician_qual',     'DMLT (PTU)'),
    ('equipment_line',      'Equipped With ERBA H360 Blood Cell Counter, ERBA CHEM-5 PLUS Vz, EBRA Semi Auto Analyser, CHEM-7 & STAR 21 Semi Auto Analyser, Uri-plus 200 Urine Chemistry Analyser, Qua-lab Hba1c Analyser.'),
    ('footer_tests_line',   'T3, T4, TSH (THYROID), LH, FSH, PROLACTIN, TESTOSTERONE, ESTRADIOL, LFT, LIPID PROFILE, KIDNEY FUNCTION TEST''S CULTURES, MALARIA ANTIGEN, TYPHOID ANTIBODIES TESTS AVAILABLES'),
    ('next_test_no',        '1'),
    ('backup_retention_days','30'),
    ('whatsapp_mode',       'semi'),
    ('financial_year',      '2026-2027');

-- ============================================================
-- Mark migration applied
-- ============================================================
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0002');
