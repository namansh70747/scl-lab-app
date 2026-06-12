-- ============================================================
-- SCL Lab App  –  Migration 0004 : SMS delivery channel + settings
-- ============================================================

-- SQLite cannot alter a CHECK constraint in place, so rebuild delivery_log with
-- 'sms' added to the allowed channels, preserving existing rows.
CREATE TABLE delivery_log_new (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    channel    TEXT    CHECK(channel IN ('whatsapp_semi','whatsapp_api','email','print','pdf','sms')) NOT NULL,
    target     TEXT,
    status     TEXT    CHECK(status IN ('queued','sent','delivered','failed')) DEFAULT 'queued',
    error      TEXT,
    at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO delivery_log_new (id, patient_id, channel, target, status, error, at)
    SELECT id, patient_id, channel, target, status, error, at FROM delivery_log;

DROP TABLE delivery_log;
ALTER TABLE delivery_log_new RENAME TO delivery_log;

-- Default SMS gateway settings (blank credentials until the lab configures them).
INSERT OR IGNORE INTO settings(key, value) VALUES
    ('sms_provider',        'fast2sms'),
    ('sms_api_key',         ''),
    ('sms_sender_id',       ''),
    ('sms_dlt_template_id', '');

-- Pre-fill Gmail SMTP defaults for the lab account so only the App Password is left to enter.
INSERT OR IGNORE INTO settings(key, value) VALUES
    ('smtp_host', 'smtp.gmail.com'),
    ('smtp_port', '587'),
    ('smtp_user', 'rajeshsharmark321@gmail.com'),
    ('smtp_pass', '');
