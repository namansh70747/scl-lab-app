-- ============================================================
-- SCL Lab App  –  Migration 0006 : CBC analyzer over network (TCP/IP)
-- ============================================================
-- The ERBA H360 transmits results over Ethernet (TCP/IP), not serial. These settings
-- describe that connection. analyzer_conn = 'network' | 'serial'.

INSERT OR IGNORE INTO settings(key, value) VALUES
    ('analyzer_conn',     'network'),
    ('analyzer_tcp_mode', 'listen'),       -- 'listen' = PC waits for the analyzer to push; 'connect' = PC dials the analyzer
    ('analyzer_host',     '192.168.1.110'),-- the H360's IP (only used in 'connect' mode)
    ('analyzer_tcp_port', '5000');         -- the host/LIS port configured on the analyzer
