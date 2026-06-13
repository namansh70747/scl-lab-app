-- ============================================================
-- SCL Lab App  –  Migration 0007 : WhatsApp Cloud API (auto-send PDF)
-- ============================================================
-- For automatic WhatsApp delivery, bsp_api_key holds the Meta access token and
-- wa_phone_id holds the WhatsApp phone-number ID from the Meta API setup page.

INSERT OR IGNORE INTO settings(key, value) VALUES
    ('wa_phone_id',     ''),
    ('wa_api_version',  'v21.0');
