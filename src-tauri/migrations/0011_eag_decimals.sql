-- Estimated Average Glucose (eAG) is a glucose value in mg/dL and should read as a whole
-- number like every other glucose test (FBS/RBS/PPBS use 0 decimals) — not "117.4".
UPDATE tests SET decimals = 0 WHERE code = 'EAG';
