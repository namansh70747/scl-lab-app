-- ============================================================
-- SCL Lab App  –  Migration 0001 : Initial Schema
-- ============================================================

-- ── Migration bookkeeping ────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    username              TEXT    UNIQUE NOT NULL,
    display_name          TEXT    NOT NULL,
    role                  TEXT    CHECK(role IN ('admin','technician')) NOT NULL DEFAULT 'technician',
    password_hash         TEXT    NOT NULL,
    active                INTEGER DEFAULT 1,
    force_password_change INTEGER DEFAULT 0,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Panels ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS panels (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    code             TEXT    UNIQUE NOT NULL,
    name             TEXT    NOT NULL,
    report_heading   TEXT    NOT NULL,
    sort_order       INTEGER DEFAULT 0,
    page_break_after INTEGER DEFAULT 0,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Tests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    code               TEXT    UNIQUE NOT NULL,
    name               TEXT    NOT NULL,
    panel_id           INTEGER REFERENCES panels(id) ON DELETE RESTRICT,
    result_type        TEXT    CHECK(result_type IN ('numeric','text','choice','calculated')) NOT NULL DEFAULT 'numeric',
    unit               TEXT,
    decimals           INTEGER DEFAULT 1,
    price              REAL    DEFAULT 0,
    enabled            INTEGER DEFAULT 1,
    sort_order         INTEGER DEFAULT 0,
    choices            TEXT,
    default_value      TEXT,
    formula            TEXT,
    interpretation_note TEXT,
    is_panel           INTEGER DEFAULT 0,
    needs_review       INTEGER DEFAULT 0,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Test Ranges ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_ranges (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id      INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    sex          TEXT    CHECK(sex IN ('M','F','ANY')) NOT NULL DEFAULT 'ANY',
    age_min_days INTEGER DEFAULT 0,
    age_max_days INTEGER DEFAULT 54750,
    low          REAL,
    high         REAL,
    range_text   TEXT,
    band_text    TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Doctors ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    UNIQUE NOT NULL,
    degree     TEXT,
    active     INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Patients ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    test_no       INTEGER UNIQUE NOT NULL,
    title         TEXT,
    name          TEXT    NOT NULL,
    age           REAL,
    age_unit      TEXT    CHECK(age_unit IN ('YRS','MTH','DAYS')) DEFAULT 'YRS',
    sex           TEXT    CHECK(sex IN ('MALE','FEMALE','OTHER')),
    phone         TEXT,
    email         TEXT,
    address       TEXT,
    doctor_id     INTEGER REFERENCES doctors(id) ON DELETE RESTRICT,
    collected_at  TEXT    DEFAULT 'SHARMA CLINICAL LABORATORY',
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sample_time   DATETIME,
    report_time   DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    test_id       INTEGER NOT NULL REFERENCES tests(id)    ON DELETE RESTRICT,
    price_charged REAL    NOT NULL DEFAULT 0,
    sample_id     TEXT,
    not_done      INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, test_id)
);

-- ── Results ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    value       TEXT,
    flag        TEXT CHECK(flag IN ('','H','L','A')) DEFAULT '',
    entered_by  INTEGER REFERENCES users(id),
    entered_at  DATETIME,
    approved_by INTEGER REFERENCES users(id),
    approved_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Bills ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER UNIQUE NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    total      REAL    DEFAULT 0,
    concession REAL    DEFAULT 0,
    net        REAL    GENERATED ALWAYS AS (total - concession) STORED,
    received   REAL    DEFAULT 0,
    balance    REAL    GENERATED ALWAYS AS (total - concession - received) STORED,
    mode       TEXT    CHECK(mode IN ('CASH','UPI','CARD')) DEFAULT 'CASH',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Report Comments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER UNIQUE NOT NULL REFERENCES patients(id),
    comment    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Delivery Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    channel    TEXT    CHECK(channel IN ('whatsapp_semi','whatsapp_api','email','print','pdf')) NOT NULL,
    target     TEXT,
    status     TEXT    CHECK(status IN ('queued','sent','delivered','failed')) DEFAULT 'queued',
    error      TEXT,
    at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Audit Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
    action      TEXT    NOT NULL,
    entity      TEXT    NOT NULL,
    entity_id   INTEGER,
    before_json TEXT,
    after_json  TEXT,
    at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT    UNIQUE NOT NULL,
    value      TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_testno  ON patients(test_no);
CREATE INDEX        IF NOT EXISTS idx_patients_name    ON patients(name);
CREATE INDEX        IF NOT EXISTS idx_patients_phone   ON patients(phone);
CREATE INDEX        IF NOT EXISTS idx_patients_regd    ON patients(registered_at);
CREATE INDEX        IF NOT EXISTS idx_orders_patient   ON orders(patient_id);
CREATE INDEX        IF NOT EXISTS idx_orders_test      ON orders(test_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_results_order    ON results(order_id);
CREATE INDEX        IF NOT EXISTS idx_tests_panel      ON tests(panel_id);
CREATE INDEX        IF NOT EXISTS idx_tests_code       ON tests(code);
CREATE INDEX        IF NOT EXISTS idx_delivery_patient ON delivery_log(patient_id);
CREATE INDEX        IF NOT EXISTS idx_audit_entity     ON audit_log(entity, entity_id);
CREATE INDEX        IF NOT EXISTS idx_audit_at         ON audit_log(at);

-- ============================================================
-- Triggers
-- ============================================================

-- Audit log is append-only
CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log rows are immutable');
END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log rows cannot be deleted');
END;

-- Approved results are locked
CREATE TRIGGER IF NOT EXISTS results_locked
BEFORE UPDATE OF value ON results
WHEN OLD.approved_at IS NOT NULL AND NEW.approved_at IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'approved result is locked; unlock first');
END;

-- updated_at triggers
CREATE TRIGGER IF NOT EXISTS patients_updated_at
AFTER UPDATE ON patients
BEGIN
    UPDATE patients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tests_updated_at
AFTER UPDATE ON tests
BEGIN
    UPDATE tests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS users_updated_at
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS doctors_updated_at
AFTER UPDATE ON doctors
BEGIN
    UPDATE doctors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS settings_updated_at
AFTER UPDATE ON settings
BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================
-- Mark migration applied
-- ============================================================
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0001');
