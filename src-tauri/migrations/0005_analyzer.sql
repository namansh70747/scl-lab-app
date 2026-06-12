-- ============================================================
-- SCL Lab App  –  Migration 0005 : CBC analyzer (ERBA H360)
-- ============================================================

-- CBC analyzer serial settings.
INSERT OR IGNORE INTO settings(key, value) VALUES
    ('analyzer_port', ''),
    ('analyzer_baud', '9600');

-- Histogram curves captured from the analyzer, kept per patient so the CBC report can
-- reprint the same graphs the machine produced. data_json = {"wbc":[…],"rbc":[…],"plt":[…]}.
CREATE TABLE IF NOT EXISTS analyzer_histograms (
    patient_id INTEGER PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
    data_json  TEXT NOT NULL,
    at         DATETIME DEFAULT CURRENT_TIMESTAMP
);
