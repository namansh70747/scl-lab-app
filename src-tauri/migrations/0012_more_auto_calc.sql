-- Switch tests that are STANDARD derived values (not measured) from manual entry to auto,
-- so staff never type a number that the app can compute exactly from other results.
-- No new tests are added; only existing rows change to result_type='calculated'.

-- BUN = Blood Urea × 0.467 (Urea is already entered). Handled by calc.ts switch on code 'BUN'.
UPDATE tests SET result_type = 'calculated', formula = 'UREA * 0.467'
WHERE code = 'BUN' AND result_type = 'numeric';

-- MCH (pg) = HGB×10 / RBC and MCHC (g/dL) = HGB×100 / HCT are always derived on every
-- analyzer; MCV and RDW are directly measured, so those stay manual/analyzer-filled.
UPDATE tests SET result_type = 'calculated', formula = 'HGB * 10 / RBC_CNT'
WHERE code = 'MCH' AND result_type = 'numeric';

UPDATE tests SET result_type = 'calculated', formula = 'HGB * 100 / HCT'
WHERE code = 'MCHC' AND result_type = 'numeric';
