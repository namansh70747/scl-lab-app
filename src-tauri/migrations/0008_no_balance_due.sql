-- ============================================================
-- SCL Lab App  –  Migration 0008 : no balance-due tracking
-- ============================================================
-- The lab collects payment manually at the counter; the app only records the day's
-- earning, not outstanding dues. Mark every existing bill as fully received so no
-- patient shows a pending balance.

UPDATE bills SET received = (total - concession) WHERE received < (total - concession);
