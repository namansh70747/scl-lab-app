-- ============================================================
-- Migration 0014 : Set proper admin identity for Sharma Clinical Laboratory
-- ============================================================
-- The seeded admin is a generic 'admin / Administrator' placeholder.
-- This migration gives the Sharma lab's admin the correct display name
-- (Rajesh Kumar Vicky, the actual lab technician-in-charge) and a
-- meaningful username 'vicky'. The password hash stays as the placeholder
-- so the first login still prompts for a real password to be set.
-- Also ensures setup_done = '1' for this existing install.

UPDATE users
SET
    username     = 'vicky',
    display_name = 'Rajesh Kumar (Vicky)',
    updated_at   = CURRENT_TIMESTAMP
WHERE role = 'admin'
  AND username = 'admin';

-- Ensure the lab identity flags are correct for this install.
INSERT OR IGNORE INTO settings(key, value)
VALUES ('setup_done', '1');

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0014');
