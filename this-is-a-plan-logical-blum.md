# Sharma Clinical Laboratory (SCL) Lab App — COMPLETE BUILD PLAN & SPECIFICATION

*This is the single source of truth. It is written so that an AI coding assistant (Sonnet/Claude Code) can build the app phase by phase with no missing decisions, AND so that you (Vaidik, non-developer) can run the test checks at each step. Every test, price, range, screen, field, table, and formula needed is included below — extracted directly from the 74 screenshots of the old "CETEC" software.*

---

## 1. Context & goal

Sharma Clinical Laboratory (G.T. Road, Village Nangal Bhur, Teh. & Distt. Pathankot) runs on a ~20-year-old VB-era program called **CETEC Software**. It works but is slow, ugly, fragile, and manual. We are replacing it with a modern **offline-first Windows desktop app** that does the same workflow — register patient → bill → enter results → approve → print a pixel-faithful SCL letterhead report → deliver by WhatsApp/email — but is fast, good-looking, error-proof, auto-backed-up, and auto-delivers reports.

**Builder model:** You build it yourself with Claude Code (Sonnet) writing the code while you direct and test. You develop on macOS; the lab PC is Windows 10/11. Tauri cannot cross-compile a Windows installer on a Mac, so **GitHub Actions (free) builds the Windows installer** on each release tag — no Windows dev machine needed.

**Minimal father involvement:** The complete test catalogue (codes, names, prices) has already been extracted from your screenshots and is embedded in Section 5 below — it ships pre-loaded, so your father does **not** need to dictate tests. The only thing he should do is a quick optional glance at the printed price/range list once, and the app's **Test Master screen lets an Admin edit any price or range in seconds** if anything needs correcting later.

**Patient-safety constraint (hard):** wrong reference range, wrong patient on a report, or lost data = real harm. So validation, an approve-lock, an audit log, and daily backups are built into the build order itself, and each phase ends with a test gate that must pass before the next begins.

---

## 2. What the old app does (confirmed from the screenshots)

- **Login / Select Company** (`IMG_6301`): pick lab + financial year (2023-24 … 2026-27), username `ADMIN`, password.
- **Main menu**: Masters | Diagnosis | Reports | Utility | Quit. Left buttons: Test Master, Category Master, Refer Master, View Day Collection, Refer Cases Report, Quit.
- **Test Receipt** (`IMG_6293/6298/6313/6366`): patient + test selection + billing. Fields: Test No (auto, e.g. 4297→4298), Reg Date+time, Report Date+time, Title+Name, Age+unit (YRS), Sex, Phone, Mode (CASH), Ref By (doctor dropdown), Collected At, Package, Address, and a test grid (Code | Test Name | Suffix | Parametric range | Rs). Billing: Total Payment, Concession, Net Payable, Recd Payment, Bal. Payment.
- **Test Data / result entry** (`IMG_6314/6315/6316/6317/6321`): per patient, results grouped by "Test Group" (HEM/BILI/LIPID/URINE…), shown across Page 1–4 tabs. Toolbar: Edit, Save, Cancel, Delete, Prev, Next, Search, **Approve**, Print, Close. Print toggles: Header Print, Head, Sub Head, **PAGE BREAK**, Signature. Printing Options radio: **Print / Preview / PDF / Email / Web Publish / WhatsApp**. Per-report Comments box.
- **Change Test Rate** (`IMG_6322–6353, 6361`): the master test catalogue — CODE | TEST NAME | AMOUNT | PANEL, footer "*Select test and press F3 to change rate*". ~200+ rows (extracted in §5).
- **Test Details / Test Head / Test Master** (`IMG_6303/6320/6369–6372/6376/6377`): the per-test editor — code, head/panel, print sequence, amount, sample type, default value, calculation/formula, and a "Normal Range as per age group" grid (From age | To age | Sex | Suffix | Parameter | Low | High).
- **Default Value Master** (`IMG_6355–6357`): pre-set pick-list values for qualitative results (e.g. urine colours, PRESENT(+)…(++++), NIL, NOT SEEN, OCCASIONAL).
- **Reference Master / Reference** (`IMG_6312/6360`): referring-doctor list (ID, RCODE, NAME).
- **Order Status / Reports** (`IMG_6318/6319/6363/6364/6379/6380`): day list of patients by name+receipt, View Reports, View Day Collection (filters: From/To date, Ref By, Mode, User, Summary). Reports menu: Refer Cases Report, Refer Case Report 2, Total Test Detail, Profit/Loss Report, Patient Test History, Categorywise Diagnose Report, Embassy Cases Report, Groupwise Report.
- **Utility**: New Financial Year (`IMG_6362`: e.g. 2027-2028, start 01/04/2027, end 31/03/2028).
- Equipment (from the printed reports/footers): **ERBA H360** cell counter (LAN, ASTM protocol → enables CBC auto-import).

**Important data-quality fact:** the old catalogue is full of duplicates, test/dummy rows ("A", "AB", "AAAAAAAAA", "TEST", "TEMP", "Y"), and the same test at different prices across screens. Section 5 is the **cleaned, deduplicated, canonical catalogue** to ship — not the raw dump. The raw dump's conflicts are noted where prices were ambiguous.

---

## 3. Locked technology decisions (nothing open)

| # | Area | Decision |
|---|---|---|
| 1 | App framework | **Tauri 2** — tiny fast app, built-in auto-updater; ~95% of code is TypeScript, Rust stays minimal |
| 2 | UI | **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui**, Lucide icons; clean white with **SCL maroon** accent (sampled from the letterhead) |
| 3 | Database | **SQLite** single file, WAL mode, via `@tauri-apps/plugin-sql`; versioned SQL migrations |
| 4 | Report/PDF | One **HTML/CSS template** rendered in a hidden webview → identical screen preview, paper print, and saved PDF; A4 portrait |
| 5 | Windows build | **GitHub Actions** `tauri-apps/tauri-action` → NSIS installer `.exe` + updater artifacts on each git tag `v*` |
| 6 | Auto-update | `@tauri-apps/plugin-updater`; manifest on GitHub Releases; you own the signing keypair |
| 7 | WhatsApp v1 | **Semi-automatic** — app saves the PDF, opens `https://wa.me/91<phone>?text=<message>` in WhatsApp Desktop, reveals the PDF for one-drag attach. ₹0, zero ban risk |
| 8 | WhatsApp v2 | **Official WhatsApp Business Cloud API** via Indian BSP (AiSensy or Interakt), one Meta-approved "report ready" utility template (~₹0.11–0.15/msg). Settings toggle switches modes |
| 9 | Email | SMTP (lab Gmail + app password) via Rust `lettre` crate behind one Tauri command |
| 10 | Backups | Daily auto-copy of the `.db` to **two** targets (local/USB + a Google-Drive-synced folder), `scl-backup-YYYY-MM-DD.db`, 30-day retention, catch-up on app start |
| 11 | Users | **Admin** (full) and **Technician** (no price/range edits, no post-approval unlock, no settings); argon2-hashed passwords |
| 12 | Audit | Append-only `audit_log` of every create/edit/approve/unlock/send/print with user + timestamp |
| 13 | Language | English UI (matches old app), base font ≥16px, full keyboard flow (Enter = next field; Ctrl+N new patient; Ctrl+F search; F9 approve; Ctrl+P print) |
| 14 | Analyzer | ERBA H360 ASTM-over-TCP listener — **Phase 7, optional**, never blocks other work |
| 15 | Rejected | Cloud-only operation; AI auto-diagnosis (app flags ranges only, never diagnoses); mobile app; multi-branch sync |

---

## 4. Data model (every table, every column)

DB file path: Windows `%APPDATA%/scl-lab-app/scl.db`; Mac dev = app-data dir. Every table has `id INTEGER PRIMARY KEY AUTOINCREMENT`, `created_at`, `updated_at`. Foreign keys `ON DELETE RESTRICT`.

### 4.1 `users`
`username TEXT UNIQUE`, `display_name TEXT`, `role TEXT CHECK(role IN ('admin','technician'))`, `password_hash TEXT`, `active INTEGER DEFAULT 1`. Seed one `admin` (force password change on first login).

### 4.2 `doctors` (Refer Master) — seed list in §5.6
`name TEXT UNIQUE`, `degree TEXT NULL`, `active INTEGER DEFAULT 1`.

### 4.3 `panels` (test groups / report sections)
`code TEXT UNIQUE`, `name TEXT`, `report_heading TEXT` (printed heading, e.g. "HEMATOLOGY"), `sort_order INTEGER`, `page_break_after INTEGER DEFAULT 0`. Seed list in §5.1.

### 4.4 `tests` (master catalogue — seed from §5)
`code TEXT UNIQUE`, `name TEXT`, `panel_id → panels`, `result_type TEXT CHECK(result_type IN ('numeric','text','choice','calculated'))`, `unit TEXT`, `decimals INTEGER DEFAULT 1`, `price REAL`, `enabled INTEGER DEFAULT 1`, `sort_order INTEGER`, `choices TEXT NULL` (JSON array for `choice` type), `default_value TEXT NULL`, `formula TEXT NULL` (for `calculated`), `interpretation_note TEXT NULL`, `is_panel INTEGER DEFAULT 0` (a sellable bundle like CBC/LFT that expands into child tests), `parent_panel_code TEXT NULL`.

### 4.5 `test_ranges` (≥1 row per numeric test; sex/age aware)
`test_id → tests`, `sex TEXT CHECK(sex IN ('M','F','ANY'))`, `age_min_days INTEGER DEFAULT 0`, `age_max_days INTEGER DEFAULT 54750`, `low REAL NULL`, `high REAL NULL`, `range_text TEXT` (exact printed string, e.g. "12.0 - 16.0", "< 0.30", "0 - 5 /hpf"), `band_text TEXT NULL` (multi-band interpretation block, e.g. cholesterol Normal/Borderline/High). **Flagging:** match row by sex+age; numeric outside [low,high] ⇒ flag H/L (printed **bold**); choice/text flagged when value ≠ its normal (e.g. ≠ "Negative"/"Not Seen"/"NIL").

### 4.6 `patients`
`test_no INTEGER UNIQUE` (auto, seeded to continue lab's current sequence — see §8 Phase 5), `title TEXT` (Mr./Mrs./Miss/Master/Baby/B-O), `name TEXT`, `age REAL`, `age_unit TEXT CHECK(age_unit IN ('YRS','MTH','DAYS'))`, `sex TEXT CHECK(sex IN ('MALE','FEMALE','OTHER'))`, `phone TEXT`, `email TEXT NULL`, `address TEXT`, `doctor_id → doctors`, `collected_at TEXT DEFAULT 'SHARMA CLINICAL LABORATORY'`, `registered_at DATETIME`, `sample_time DATETIME`, `report_time DATETIME NULL`.

### 4.7 `orders` (one row per patient×test)
`patient_id → patients`, `test_id → tests`, `price_charged REAL` (frozen at order time), `sample_id TEXT` (= test_no by default; barcode-ready), `not_done INTEGER DEFAULT 0`, UNIQUE(patient_id, test_id).

### 4.8 `results`
`order_id UNIQUE → orders`, `value TEXT` (numerics stored as text, parsed for flagging), `flag TEXT CHECK(flag IN ('','H','L','A'))`, `entered_by → users`, `entered_at DATETIME`, `approved_by → users NULL`, `approved_at DATETIME NULL`. **Approve-lock invariant (code + UI):** once `approved_at` set, UPDATE only via Admin "unlock" which audit-logs old+new value.

### 4.9 `bills`
`patient_id UNIQUE → patients`, `total REAL`, `concession REAL DEFAULT 0`, `net REAL` (computed = total−concession), `received REAL`, `balance REAL` (computed = net−received), `mode TEXT CHECK(mode IN ('CASH','UPI','CARD'))`.

### 4.10 `report_comments`
`patient_id UNIQUE → patients`, `comment TEXT`.

### 4.11 `delivery_log`
`patient_id`, `channel TEXT CHECK(channel IN ('whatsapp_semi','whatsapp_api','email','print','pdf'))`, `target TEXT`, `status TEXT CHECK(status IN ('queued','sent','delivered','failed'))`, `error TEXT NULL`, `at DATETIME`.

### 4.12 `audit_log` (append-only; no UPDATE/DELETE in code)
`user_id`, `action TEXT`, `entity TEXT`, `entity_id INTEGER`, `before_json TEXT`, `after_json TEXT`, `at DATETIME`.

### 4.13 `settings` (key/value)
lab_name, address_line, phones, timings, technician_name, equipment_line, footer_tests_line, logo_path, signature_path, printer_name, backup_dir_1, backup_dir_2, backup_retention_days (=30), smtp_host/port/user/pass(encrypted), whatsapp_mode ('semi'|'api'), bsp_api_key(encrypted), bsp_template_name, next_test_no, financial_year.

### 4.14 Integrity rules (hard, code-level)
1. `renderReport(patientId)` takes ONE patient_id; reads only that patient's orders → their results. No code path mixes patients.
2. Render refuses (visible error, no output) if any ordered (not `not_done`) test lacks a result, any result unapproved, or any sample_id mismatch.
3. `net`, `balance`, and all `calculated` test values are computed, never accepted from input.

---

## 4A. DATABASE — full implementation spec (every pragma, index, trigger, migration)

The database is the heart of patient safety, so this is specified to the level the builder can write the SQL directly.

### 4A.1 Connection & pragmas (set on every open, in `db.ts`)
```sql
PRAGMA journal_mode = WAL;        -- concurrent reads while writing; crash-safe
PRAGMA synchronous = NORMAL;      -- fast + safe with WAL
PRAGMA foreign_keys = ON;         -- enforce FK constraints (off by default in SQLite!)
PRAGMA busy_timeout = 5000;       -- wait 5s rather than erroring on a lock
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -16000;       -- ~16MB page cache
```
Single-writer model (one PC) → no contention; WAL gives instant reads. A periodic `PRAGMA wal_checkpoint(TRUNCATE)` runs nightly with the backup.

### 4A.2 Indexes (create in `0001_init.sql` — these make search "instant")
```sql
CREATE UNIQUE INDEX idx_patients_testno ON patients(test_no);
CREATE INDEX idx_patients_name   ON patients(name);
CREATE INDEX idx_patients_phone  ON patients(phone);
CREATE INDEX idx_patients_regd   ON patients(registered_at);
CREATE INDEX idx_orders_patient  ON orders(patient_id);
CREATE INDEX idx_orders_test     ON orders(test_id);
CREATE UNIQUE INDEX idx_results_order ON results(order_id);
CREATE INDEX idx_tests_panel     ON tests(panel_id);
CREATE INDEX idx_tests_code      ON tests(code);
CREATE INDEX idx_delivery_patient ON delivery_log(patient_id);
CREATE INDEX idx_audit_entity    ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_at        ON audit_log(at);
```
For fuzzy name search, also build a lightweight in-memory index in the app (names are few-thousand scale); optionally an FTS5 virtual table `patients_fts(name, phone)` if the dataset grows.

### 4A.3 Constraints & data-integrity enforced IN THE SCHEMA (not just app code)
- All CHECK constraints from §4 (role, sex, age_unit, result_type, flag, mode, channel, status).
- `orders` UNIQUE(patient_id, test_id) — a test can't be ordered twice for one patient.
- `results` UNIQUE(order_id) — one result per order.
- FKs `ON DELETE RESTRICT` everywhere (you can't delete a patient/test/doctor that's referenced).
- Generated columns where useful, e.g. `bills.net REAL GENERATED ALWAYS AS (total - concession) STORED`, `bills.balance AS (total - concession - received) STORED` — so net/balance can never be wrong.

### 4A.4 Triggers (defense-in-depth for the safety rules)
```sql
-- 1. Append-only audit: block edits/deletes of audit rows
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT,'audit_log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT,'audit_log is append-only'); END;

-- 2. Approve-lock: once approved, value changes only when a flag is set by the unlock path
--    (app sets settings/session flag; simplest: block UPDATE of approved results unless
--     the same statement also nulls approved_at — i.e. an explicit unlock)
CREATE TRIGGER results_locked BEFORE UPDATE OF value ON results
  WHEN OLD.approved_at IS NOT NULL AND NEW.approved_at IS NOT NULL
  BEGIN SELECT RAISE(ABORT,'approved result is locked; unlock first'); END;

-- 3. updated_at maintenance on each table
CREATE TRIGGER patients_touch AFTER UPDATE ON patients
  BEGIN UPDATE patients SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
-- (repeat per table)
```

### 4A.5 Migration strategy
- Numbered files `0001_init.sql`, `0002_seed.sql`, `0003_*.sql`… run in order on app start; a `schema_migrations(version, applied_at)` table records which ran. **Never edit an applied migration** — always add a new one (so the lab PC upgrades cleanly via auto-update). The migration runner wraps each file in a transaction; a failure rolls back and aborts startup with a clear message (and the daily backup is the safety net).

### 4A.6 Seeding pipeline (`0002_seed.sql` generated from `seed/*.csv`)
- A small Node script (`scripts/build-seed.ts`) reads `seed/catalogue.csv`, `ranges.csv`, `doctors.csv`, `interpretations.csv` and emits idempotent `INSERT OR IGNORE` statements into `0002_seed.sql`. Re-runnable; editing a CSV + re-running updates the seed migration. Panels seeded first (§5.1), then tests (FK to panels), then ranges (FK to tests), then interpretations, then doctors, then the default `admin` user, then `settings` defaults (lab header/footer text from §8, next_test_no, financial year).

### 4A.7 Transaction patterns (must be used — concurrency & crash safety)
- **Save receipt** = ONE transaction: insert patient → insert N orders (freezing price_charged) → insert bill → bump `settings.next_test_no`. All-or-nothing (proven by the G2 force-quit test).
- **Approve** = ONE transaction: update all results' approved_by/at → set patient.report_time → write audit row.
- **Unlock** = ONE transaction: clear approved_at → write audit row(before/after) → (re-approve later).
- Every write that changes meaningful data also writes an `audit_log` row in the same transaction.

### 4A.8 Backup & restore mechanics (the can't-lose-data layer)
- Backup uses SQLite's safe **online backup** (copy the DB while WAL is checkpointed) — not a naive file copy mid-write. Implemented in Rust (`commands/backup.rs`): checkpoint → copy `scl.db` to `backup_dir_1/scl-backup-YYYY-MM-DD.db` and `backup_dir_2/…` → verify the copy opens and `PRAGMA integrity_check` passes → prune copies older than `retention_days` (30).
- Triggered: on first app launch each day (compares last-backup date) AND a 9pm timer; manual "Backup now" in Settings.
- **Restore wizard:** pick a backup file → integrity-check it → close current DB → swap in the chosen file (current DB renamed `scl.db.pre-restore`) → reopen. Fully logged.

### 4A.9 Typical queries the app issues (so the builder writes them as prepared statements)
- Today's dashboard: patients where `date(registered_at)=date('now','localtime')` with bill + status (status derived from results' approved state).
- Patient search: `WHERE name LIKE ?||'%' OR test_no=? OR phone LIKE ?||'%'` (indexed).
- Result entry load: orders + tests + ranges for a patient (one JOIN), results LEFT JOIN.
- Report render: the single-patient JOIN described in §4.14, ordered by panel.sort_order, test.sort_order.
- Business reports: date-range aggregates on bills grouped by day/month/doctor/test.

## 5. THE COMPLETE TEST CATALOGUE (ships pre-loaded as seed data)

Extracted and deduplicated from the "Change Test Rate" list (`IMG_6322–6353`, `6361`), the BIOCHEMISTRY "Test Details" list (`IMG_6369–6372`, cleanest source for biochem prices), the result-entry screens (`IMG_6313–6317`), and the Default Value Master (`IMG_6355–6357`). Prices are in ₹. Where the screenshots showed conflicting prices for the same test, the most consistent/legible value is used and flagged `⚠price`. Codes are normalized (the old app had many duplicate codes; the seed uses one clean code per test). **All of this loads into `tests`/`test_ranges`/`panels` via the seed migration; Admin can edit any field in the Test Master screen.**

### 5.1 Panels (`panels` seed)
| code | report_heading | sort | page_break_after |
|---|---|---|---|
| HEM | HEMATOLOGY | 10 | 0 |
| CBC | COMPLETE BLOOD COUNT (CBC) | 11 | 1 |
| BIO | BIOCHEMISTRY | 20 | 0 |
| LFT | LIVER FUNCTION TEST (LFT) | 21 | 0 |
| KFT | RENAL FUNCTION TEST (RFT/KFT) | 22 | 0 |
| LIPID | LIPID PROFILE | 23 | 0 |
| ELEC | ELECTROLYTES | 24 | 0 |
| DIAB | DIABETIC PROFILE | 25 | 0 |
| THY | THYROID PROFILE | 30 | 0 |
| HORM | HORMONES | 31 | 0 |
| SERO | SEROLOGY / IMMUNOLOGY | 40 | 0 |
| COAG | COAGULATION | 45 | 0 |
| URINE | URINE EXAMINATION | 50 | 1 |
| STOOL | STOOL EXAMINATION | 55 | 1 |
| FLUID | BODY FLUID / SEMEN | 60 | 1 |
| MICRO | MICROBIOLOGY / CULTURE | 65 | 0 |
| MISC | MISCELLANEOUS | 90 | 0 |

### 5.2 Hematology (`HEM` / `CBC`)
| code | name | unit | result_type | price | normal range |
|---|---|---|---|---|---|
| HB | Haemoglobin (HB) | gm/dl | numeric | 30 | 13.5–17.5 (M) / 12.0–16.0 (F) |
| TLC | Total Leucocyte Count (TLC) | /cumm | numeric | 30 | 4,000–11,000 |
| DLC | Differential Leucocyte Count | % | text | 40 | (Neutro/Lympho/Mono/Eo/Baso) |
| PLT | Platelet Count | /cumm | numeric | 100 | 1,50,000–4,50,000 |
| ESR | ESR | mm/hr | numeric | 50 | M <15 / F <20 |
| AEC | Absolute Eosinophil Count | /cumm | numeric | 150 | 40–440 |
| RET | Reticulocyte Count | % | numeric | 350 | 0.5–2.5 |
| PCV | Packed Cell Volume (PCV/HCT) | % | numeric | — | 40–50 (M) / 36–46 (F) |
| PBF | Peripheral Blood Film | — | text | 150 | — |
| ABO | Blood Group (ABO & Rh) | — | choice | 30 | choices: A+,A-,B+,B-,AB+,AB-,O+,O- |
| BT | Bleeding Time (BT) | min | numeric | 20 | 2–7 |
| CT | Clotting Time (CT) | min | numeric | 20 | 4–9 |
| CBC | **Complete Blood Count (panel)** | — | calculated panel | 250 | expands to CBC sub-params below |

**CBC sub-parameters** (panel `CBC`, from the ERBA H360 printout; each its own numeric row + range): WBC, Neutrophils %, Lymphocytes %, Monocytes %, Eosinophils %, Basophils %, Neut#, Lymph#, Mono#, Eos#, Baso#, RBC Count, HGB, HCT/PCV, MCV, MCH, MCHC, RDW-SD, RDW-CV, Platelet Count, MPV, PCT, PDW-SD, PDW-CV, P-LCR, P-LCC. (Histograms WBC/RBC/PLT print as images when imported from the H360 in Phase 7.)

### 5.3 Biochemistry — cleanest source is the BIOCHEMISTRY Test Details list (`IMG_6369–6372`)

**Glucose / Diabetic (`DIAB`/`BIO`)**
| code | name | unit | type | price | range |
|---|---|---|---|---|---|
| FBS | Glucose (Fasting) | mg/dl | numeric | 20 | 70–110 |
| RBS | Glucose (Random) | mg/dl | numeric | 20 | 70–140 |
| PPBS | Glucose (Post Prandial) | mg/dl | numeric | 20 | 70–140 |
| HBA1C | HbA1c (Glycosylated Hb) | % | numeric | 350 | bands: <5.7 normal / 5.7–6.4 pre-diabetic / ≥6.5 diabetic |
| EAG | Estimated Avg Glucose | mg/dl | calculated | 0 | =28.7×HbA1c−46.7 |
| GTT | Glucose Tolerance Test | mg/dl | numeric | 150 | per timepoint |

**Kidney / Electrolytes (`KFT`/`ELEC`)**
| code | name | unit | type | price | range |
|---|---|---|---|---|---|
| UREA | Blood Urea | mg/dl | numeric | 50 | 15–45 |
| BUN | BUN (Blood Urea Nitrogen) | mg/dl | numeric | 50 (⚠20) | 7–20 |
| CRT | S. Creatinine | mg/dl | numeric | 50 | 0.60–1.20 (M&F, from Test Head `IMG_6303`) |
| UA | S. Uric Acid | mg/dl | numeric | 50 (⚠100) | M 3.5–7.2 / F 2.6–6.0 |
| NA | Sodium (Na) | mEq/L | numeric | 100 | 135–145 |
| K | Potassium (K) | mEq/L | numeric | 100 | 3.5–5.1 |
| CL | Chloride (Cl) | mEq/L | numeric | 100 | 98–107 |
| CAL | S. Calcium (Serum) | mg/dl | numeric | 100 | 8.5–10.5 |
| BCALI | Calcium (Ionized) | mg/dl | numeric | 50 | 4.5–5.6 |
| PHO | Phosphorus | mg/dl | numeric | 200 | 2.5–4.5 |
| MAG | Magnesium | mg/dl | numeric | 500 | 1.7–2.2 |
| LIT | Lithium | mEq/L | numeric | 500 | 0.6–1.2 |
| MAU | Microalbuminuria | mg/L | numeric | 400 | <30 |
| BC | Bicarbonate | mEq/L | numeric | 450 | 22–29 |
| GFR | Creatinine eGFR | mL/min | calculated | 50 | >90 |

**LFT (`LFT`)**
| code | name | unit | type | price | range |
|---|---|---|---|---|---|
| BBT | S. Bilirubin Total | mg/dl | numeric | 50 | 0.30–1.20 |
| BBD | S. Bilirubin Direct | mg/dl | numeric | 0 | < 0.30 |
| BBI | S. Bilirubin Indirect | mg/dl | calculated | 0 | 0.00–0.80 (=BBT−BBD) |
| OT | SGOT (AST) | U/L | numeric | 50 | < 40 |
| PT_ALT | SGPT (ALT) | U/L | numeric | 50 | < 40 |
| ALP | S. Alkaline Phosphatase | IU/L | numeric | 180 | 108–306 |
| BGGT | Gamma GT (GGT) | U/L | numeric | 200 | 10–50 |
| TPN | Total Protein | g/dl | numeric | 100 | 6.4–8.3 |
| ALB | S. Albumin | g/dl | numeric | 100 | 3.5–5.2 |
| GLO | S. Globulin | g/dl | calculated | 100 | 1.9–3.7 (=TPN−ALB) |
| BAG | A:G Ratio | — | calculated | 0 | 0.9–2.0 (=ALB/GLO) |

**Lipid Profile (`LIPID`)**
| code | name | unit | type | price | range / bands |
|---|---|---|---|---|---|
| CHOL | S. Cholesterol Total | mg/dl | numeric | 50 | Normal <200 / Borderline 200–239 / High ≥240 |
| TG | S. Triglycerides | mg/dl | numeric | 150 | Normal <150 / Borderline 150–199 / High 200–499 |
| BHDL | S. HDL Cholesterol | mg/dl | numeric | 150 | Low <40 / Normal 40–60 / High >60 |
| BLDL | S. LDL Cholesterol | mg/dl | numeric | 100 | Optimal <100 / Near 100–129 / Borderline 130–159 / High ≥160 |
| BVLDL | VLDL Cholesterol | mg/dl | calculated | 100 | 12–30 (=TG/5) |
| BRAT | Total Chol / HDL Ratio | — | calculated | 0 | 0–4.8 |
| BLHR | LDL / HDL Ratio | — | calculated | 0 | 0–3.5 |
| TL | Total Lipids | mg/dl | numeric | — | 400–700 |
| NHDL | Non-HDL Cholesterol | mg/dl | calculated | 0 | <130 (=CHOL−HDL) |

**Cardiac / Enzymes / Iron (`BIO`)**
| code | name | unit | type | price |
|---|---|---|---|---|
| CPKM | CPK-MB | U/L | numeric | 600 |
| CPKN | CPK-NAC | U/L | numeric | 450 |
| LDH1 | LDH | U/L | numeric | 300 |
| ACP | Acid Phosphatase | U/L | numeric | 350 |
| LPA | S. Lipase | U/L | numeric | 400 |
| AMY | S. Amylase | U/L | numeric | 400 (⚠600) |
| IRON | Serum Iron | µg/dl | numeric | 200 | 
| TIBC | Total Iron Binding Capacity | µg/dl | numeric | 450 |
| FOL | Folic Acid | ng/ml | numeric | 800 |
| G6QT | G6PD | U/g Hb | numeric | 260 |
| OCB | Occult Blood | — | choice | 100 |
| AMM | Ammonia | µg/dl | numeric | 700 |
| VTB | Vitamin B12 | pg/ml | numeric | 900 |
| VITD | Vitamin D (25-OH) | ng/ml | numeric | 700 |
| FER | Ferritin | ng/ml | numeric | 600 |
| HSCRP | hs-CRP | mg/L | numeric | 550 |
| CERU | Ceruloplasmin | mg/dl | numeric | 800 |

### 5.4 Thyroid & Hormones (`THY`/`HORM`)
| code | name | unit | price |
|---|---|---|---|
| TSH | TSH | µIU/ml | 200 |
| T3 | Triiodothyronine Total (T3) | ng/dl | 250 |
| T4 | Thyroxine Total (T4) | µg/dl | 250 |
| FT3 | Free T3 (FT3) | pg/ml | 250 |
| FT4 | Free T4 (FT4) | ng/dl | 300 |
| TFT | Thyroid Profile (T3,T4,TSH) | — | 600 (panel) |
| LH | Luteinizing Hormone (LH) | mIU/ml | 450 |
| FSH | Follicle Stimulating Hormone (FSH) | mIU/ml | 450 |
| PRL | Prolactin | ng/ml | 490 |
| PROG | Progesterone | ng/ml | 500 |
| TESTO | Testosterone Total | ng/dl | 550 |
| FTESTO | Free Testosterone | pg/ml | 1100 |
| E2 | Estradiol (E2) | pg/ml | 500 |
| AMH | Anti-Mullerian Hormone (AMH) | ng/ml | 1850 (⚠1300) |
| DHEA | DHEA Sulphate | µg/dl | 800 |
| INS | Insulin (Fasting) | µIU/ml | 550 |
| INSPP | Insulin (Post Prandial) | µIU/ml | 550 |
| CORT | Serum Cortisol | µg/dl | 750 |
| HGH | Growth Hormone (HGH) | ng/ml | 600 |
| BETA | Beta-HCG (Serum) | mIU/ml | 600 |
| PTH | PTH (Parathyroid) | pg/ml | 1000 |

### 5.5 Serology / Immunology / Markers (`SERO`) and Coagulation (`COAG`)
| code | name | type | price |
|---|---|---|---|
| WIDAL | Widal Test (Slide) | text/titre | 50 |
| WIDALT | Widal (Tube Method) | text/titre | 800 |
| CRP | C-Reactive Protein (CRP) | numeric | 200 |
| ASO | Anti Streptolysin-O (ASO) | numeric | 200 |
| RA | Rheumatoid Factor (RA) | numeric | 450 |
| ANA | ANA (Anti-Nuclear Antibody) | choice | 900 |
| CCP | Anti-CCP | numeric | 1200 |
| TPO | Anti-TPO | numeric | 1100 |
| TTG | Anti-Tissue Transglutaminase (IgA) | numeric | 850 |
| HBSAG | HBsAg (Hepatitis B) | choice | 100 |
| HCV | Anti-HCV (Hepatitis C) | choice | 400 |
| HIV | HIV I & II Antibody | choice | 250 |
| VDRL | VDRL / RPR | choice | 100 |
| HAV | Anti-HAV (IgM) | choice | 500 |
| HEV | HEV-IgM | choice | 1450 |
| NS1 | Dengue NS1 Antigen | choice | 450 |
| DENG | Dengue IgG/IgM | choice | 600 |
| MPA | Malaria Antigen | choice | 100 |
| MPS | Malaria Parasite (Slide) | choice | 50 |
| TYPHI | Typhi Dot (Serum) | choice | 300 |
| CG | Chikungunya IgM | choice | 400 |
| SCRUB | Scrub Typhus IgM | choice | 300 (⚠1000) |
| TORCH | TORCH Profile (IgG) | — | 1100 |
| TORM | TORCH Profile (IgM) | — | 1300 |
| PSA | PSA (Prostate, Total) | numeric | 650 |
| CEA | CEA | numeric | 750 |
| AFP | Alpha Feto Protein (AFP) | numeric | 850 |
| CA125 | CA-125 | numeric | 1000 |
| CA199 | CA 19.9 | numeric | 1000 |
| CA153 | CA 15.3 | numeric | 900 |
| UPT | Pregnancy (HCG) Test — Urine | choice | 30 (⚠50) |
| PT_PT | Prothrombin Time (PT) | numeric | 200 | (COAG) |
| INR | INR | calculated | 0 | (COAG) |
| APTT | APTT | numeric | 350 | (COAG) |
| DDIMER | D-Dimer (Quantitative) | numeric | 900 (⚠1500) | (COAG) |
| TROP | Troponin-T | choice/numeric | 900 | (COAG) |
| BNP | NT-proBNP | numeric | 1800 | (COAG) |

### 5.6 Urine (`URINE`), Stool (`STOOL`), Body fluids (`FLUID`), Culture (`MICRO`)

**Urine Examination panel** (`URINE`, sells as `URINE EXAMINATION` ₹50). Components and their result_type/default (from `IMG_6317` + Default Value Master `IMG_6355–6357`):
| component | type | default | normal/choices |
|---|---|---|---|
| Quantity | text | — | (e.g. "20 ML") |
| Colour | choice | PALE YELLOW | PALE YELLOW, YELLOW, DEEP YELLOW, LIGHT YELLOW, REDDISH, BROWNISH, WATERY, MILKY, SLIGHT BROWN |
| Appearance | choice | CLEAR | CLEAR, SLIGHTLY TURBID, TURBID |
| Reaction (pH) | numeric | 6.0 | 4.5–8.0 |
| Specific Gravity | numeric | 1.020 | 1.010–1.030 |
| Urine Protein (Albumin) | choice | NIL | NIL, TRACE, PRESENT(+), PRESENT(++), PRESENT(+++), PRESENT(++++) |
| Urine Glucose (Sugar) | choice | NIL | NIL, TRACE, PRESENT(+)…(++++) |
| Ketones (Acetone) | choice | NEGATIVE | NEGATIVE, POSITIVE, TRACE |
| Bile Pigments | choice | NEGATIVE | NEGATIVE, POSITIVE |
| Bile Salts | choice | NEGATIVE | NEGATIVE, POSITIVE |
| Urobilinogen | choice | NORMAL | NORMAL, INCREASED |
| Nitrite | choice | NEGATIVE | NEGATIVE, POSITIVE |
| Pus Cells | text | — | 0–5 /hpf |
| Red Blood Cells (RBC) | choice | NOT SEEN | NOT SEEN, 0–2 /hpf, 2–4 /hpf, OCCASIONAL |
| Epithelial Cells | choice | OCCASIONAL | NOT SEEN, OCCASIONAL, 2–4 /hpf |
| Casts | choice | NOT SEEN | NOT SEEN, HYALINE, GRANULAR |
| Crystals | choice | NOT SEEN | NOT SEEN, CALCIUM OXALATE SEEN, URATES, PHOSPHATES |
| Amorphous Deposits | choice | ABSENT | ABSENT, PRESENT |

Standalone urine tests: Urine Microalbumin/ACR ₹600, Urine Culture ₹400, Urine Na ₹100, Urine K ₹100, 24-Hr Urinary Protein, Urine Glucose timed (Fasting/1Hr/1½Hr/2Hr).

**Stool (`STOOL`):** Stool Examination ₹50 (Colour, Consistency, Mucus, Blood, Pus Cells, RBC, Ova, Cyst, Occult Blood); Occult Blood ₹30.

**Body fluid / Semen (`FLUID`):** Semen Analysis ₹300; Fluid Analysis ₹1500; Pleural Fluid Analysis ₹500; CSF Biochemistry ₹200.

**Culture (`MICRO`):** Blood Culture ₹900, Urine Culture ₹400, Pus Culture ₹250, Sputum Culture ₹100, Stool Culture ₹400, Semen Culture ₹300, AFB Smear ₹100, Gram Stain ₹80, KOH Mount ₹100, Mantoux ₹100.

### 5.7 Packages / panels (sellable bundles)
LIPID PROFILE ₹300 · LFT ₹400 · RFT/KFT ₹300–800 · THYROID PROFILE ₹600 · IRON PROFILE ₹500 · HEALTH PACK ₹1400 · HEALTH PANEL ₹400 · HEALTH PANEL 1 ₹1150. A package = `is_panel=1` test that, when added to a receipt, expands into its child orders for result entry but bills as one line.

### 5.8 Referring doctors (`doctors` seed — from `IMG_6312`, `6360`, receipts)
DR VARINDER MAHAJAN · DR RAKESH SHARMA · DR JOGINDER MAHAJAN · DR AMIT GUPTA (DM Cardiology) · DR MOHIT MAHAJAN (DM Nephrology) · DR ASHWANI · DR BALBIR · DR DHANJEET · DR JEEVAN · DR KARANDEEP SINGH · DR KEVAL KRISHAN · DR LAL CHAND · DR MOHAN · DR MUKESH · DR NARINDER · DR NATHA RAM · DR PARVEEN KUMAR · DR PAWAN · DR RAJ KUMAR · AJAY · **SELF** (walk-in). Admin can add more inline.

### 5.10 Interpretation & Diagnosis Library (printed under the relevant panel — EDITABLE)

These interpretation blocks attach to a test/panel (`tests.interpretation_note` / `test_ranges.band_text`) and print beneath the results, exactly like the originals. **Two sources:** (a) the lab's own wording transcribed **verbatim** from the real reports — use these as-is; (b) standard, clinically-correct blocks I authored for panels the lab will use but where no printed sample existed. **Every block is editable in the Test Master "Interpretation" tab** (Admin) — plain text, no code change needed.

**(a) Glucose (Fasting/Random) — VERBATIM from reports r1/r3/r4, prints under the glucose row:**
> *Interpretation (in accordance with the American diabetes association guidelines):*
> *A fasting plasma glucose level below 110 mg/dL is considered normal.*
> *A fasting plasma glucose level between 110-126 mg/dL is considered as glucose intolerant or pre diabetic. A fasting and post-prandial blood sugar test (after consumption of 75 gm of glucose) is recommended for all such patients.*
> *A fasting plasma glucose level of above 126 mg/dL is highly suggestive of a diabetic state. A repeat fasting test is strongly recommended for all such patients. A fasting plasma glucose level in excess of 126 mg/dL on two different occasions is confirmatory of a diabetic state.*

**(b) HbA1c — VERBATIM bands + REMARKS from report r5, prints under HbA1c + Estimated Average Glucose:**
Bands column: `4.0-5.6 Non-diabetic` · `5.7-6.3 Prediabetic` · `6.3-7.0 Good control` · `7.0-8.0 Fair control` · `>8.0 Poor control`. Estimated Average Glucose printed as a calculated row (`EAG = 28.7×HbA1c − 46.7`).
> *REMARKS: In vitro quantitative determination of HbA1c in whole blood is utilized in long term monitoring of glycemia. The HbA1c level correlates with the mean glucose concentration prevailing in the course of the patient's recent history (approx. 6-8 weeks) and therefore provides much more reliable information for glycemia monitoring than do determinations of blood glucose or urinary glucose. It is recommended that the determination of HbA1c be performed at intervals of 4-6 weeks during Diabetes Mellitus therapy. Results of HbA1c should be assessed in conjunction with the patient's medical history, clinical examinations and other findings.*

**(c) Lipid Profile — authored standard bands (NCEP ATP III), prints under the panel:**
> Total Cholesterol: Desirable < 200 · Borderline high 200–239 · High ≥ 240 mg/dL.
> LDL Cholesterol: Optimal < 100 · Near optimal 100–129 · Borderline high 130–159 · High 160–189 · Very high ≥ 190 mg/dL.
> HDL Cholesterol: Low (risk) < 40 · High (protective) ≥ 60 mg/dL.
> Triglycerides: Normal < 150 · Borderline high 150–199 · High 200–499 · Very high ≥ 500 mg/dL.
> A higher Total Cholesterol/HDL ratio indicates greater cardiovascular risk. Results should be interpreted with the patient's overall risk factors.

**(d) Thyroid Profile — authored standard:**
> T3, T4 and TSH together assess thyroid function. A high TSH with low T4 suggests primary hypothyroidism; a low TSH with high T3/T4 suggests hyperthyroidism. Mild TSH elevation with normal T4 suggests subclinical hypothyroidism. Correlate clinically; TSH varies with age, pregnancy, and medication.

**(e) LFT — authored standard (panel already prints exact ranges per r6):**
> Raised SGOT/SGPT indicate hepatocellular injury; a raised Alkaline Phosphatase/GGT pattern suggests cholestasis. Raised bilirubin with normal enzymes may indicate haemolysis or Gilbert's syndrome. Low albumin or reversed A:G ratio may reflect chronic liver disease. Interpret together with clinical findings.

**(f) KFT/RFT — authored standard:**
> Raised Urea and Creatinine with reduced eGFR indicate impaired renal function. Electrolyte (Na/K) disturbances require urgent correlation. A single abnormal value should be confirmed and interpreted with hydration status and clinical context.

**(g) Widal — authored standard:** *Titres ≥ 1:160 for O and H antigens are generally significant for enteric fever in a non-vaccinated patient; a four-fold rise in paired samples is confirmatory. Correlate with clinical features; a single titre may reflect past infection or vaccination.*

**(h) CBC — authored optional note:** *Results are generated on a 3-part differential cell counter (ERBA H360). Abnormal flags should be confirmed on a peripheral blood film where clinically indicated.*

> **Authoring discipline (for the builder & for safety):** Blocks (a)/(b) are the lab's own printed words — ship them exactly. Blocks (c)–(h) are standard reference interpretations; ship them as editable defaults, flagged `needs_review=1` so an Admin can adjust wording to the lab's preference. The app **never** writes a patient-specific diagnosis automatically — it prints these fixed reference notes plus the per-value H/L flags only. Diagnosis remains the doctor's role.

> **Seeding note for the builder:** Generate `seed/catalogue.csv` (tests) + `seed/ranges.csv` + `seed/doctors.csv` + `seed/interpretations.csv` from the tables above and load them in migration `0002_seed.sql`. Mark every `⚠price` test and every range NOT explicitly in §5 as `needs_review=1` (a non-blocking flag the Test Master screen highlights yellow) so an Admin can confirm later — but ship them all **enabled** so the lab is fully operational from day one. Ranges quoted here without a screenshot source are standard adult clinical references; the genuinely screenshot-confirmed ones are: Creatinine 0.60–1.20, HB 12.0–16.0(F), TLC 4,000–11,000, Bilirubin Total 0.30–1.20 / Direct <0.30 / Indirect 0.00–0.80, Platelets 1,50,000–4,50,000, urine pH 4.5–8.0, SG 1.010–1.030, Pus cells 0–5/hpf, lipid bands as printed.

---

## 6. Derived-value formulas (`src/lib/calc.ts` — pure functions + Vitest unit tests)
- `BBI = max(0, BBT − BBD)`
- `GLO = TPN − ALB`
- `BAG (A:G) = ALB / GLO`
- `BVLDL = TG / 5`
- `NHDL = CHOL − BHDL`
- `BLDL (if not measured) = CHOL − BHDL − TG/5` (Friedewald; suppress if TG > 400)
- `BRAT = CHOL / BHDL`
- `BLHR = BLDL / BHDL`
- `EAG = 28.7 × HBA1C − 46.7`
- `BUN = UREA × 0.467`
- `GFR` = CKD-EPI from creatinine, age, sex.
Rules: recompute live as inputs are typed; round to the test's `decimals`; division-by-zero or missing input → blank (never NaN on a report).

---

## 7. Screens (field-by-field)

Global shell: left sidebar (Dashboard · New Patient · Patients · Test Master · Doctors · Reports · Settings), top bar (lab name · logged-in user · date), maroon-on-white, base font ≥16px. Full keyboard operation: **Enter** = next field, **Esc** = cancel, **Ctrl+N** new patient, **Ctrl+F** search, **F9** approve, **Ctrl+P** print.

### 7.1 Login
Username + password (argon2). 5 failed attempts → 5-min lockout (logged). First admin login forces password change.

### 7.2 Dashboard
Cards: Today's Patients · Reports Pending/Done · Today's Collection ₹ · Balance Due ₹. **"Waiting to send" tray**: approved-but-undelivered reports with one-click Send/Print. Today's patient list (Test No, Name, tests, paid/balance, status chips: Registered → Results Pending → Approved → Delivered). Big buttons → New Patient / Today's List / Search / Pending Results.

### 7.3 New Patient / Receipt (mirrors old "Test Receipt")
Tab order: Test No (auto, read-only) · Date (now) · Title (Mr./Mrs./Miss/Master/Baby/B-O) · Name (required, UPPERCASE) · Age (req) + Unit (YRS/MTH/DAYS) · Sex (auto-suggested from Title) · Phone (10-digit; warn-but-allow blank) · Email (optional, format-checked) · Ref By (searchable doctor dropdown + "➕ add new") · Collected At (default lab name) · Address · Sample Time (now).
**Test picker:** search by code OR name; panel quick-chips (CBC, LFT, KFT, LIPID, DIAB, URINE…) add a whole bundle; selected list shows test + price + remove ✕. Adding a `is_panel` test expands into its children for result entry but shows one bill line.
**Billing:** Total = Σ price_charged · Concession (₹ or %) · **Net (read-only)** · Received · **Balance (read-only)** · Mode (CASH/UPI/CARD).
**Save (Ctrl+S):** one SQL transaction writes patient + orders + bill, increments `next_test_no`, offers receipt print, jumps to Result Entry.
**Edge cases:** duplicate name+phone same day → warn (allow); age 0 ok for newborns (DAYS); age >120 YRS blocked; concession > total blocked; received > net warned.

### 7.4 Result Entry (mirrors old "Test Data")
Header strip: Test No, Name, Age/Sex, Ref By, status. Prev/Next + Search (like the old app). Tests grouped by panel (old Page 1–4 tabs → scrollable panel sections).
Per row by `result_type`: **numeric** → number input with unit + range_text beside; out-of-range turns row **red + bold** with H/L chip live. **choice** → dropdown of `choices`, default pre-selected (urine: Enter-through defaults fast). **text** → free text. **calculated** → grey read-only, live-updates.
Comments box (prints). **Approve (F9):** verifies every non-`not_done` ordered test has a value (a test with no value must be explicitly "mark not done", which drops it from the report and optionally refunds the bill line) → confirm → sets approved_by/at, locks inputs, stamps report_time. Post-approval edit = Admin "Unlock" with typed reason, audit-logged old+new.

### 7.5 Report Preview & Output
Live A4 preview (same HTML that prints). Toggles: per-panel page break, signature on/off. Buttons: **Print** (silent to default printer, fallback dialog) · **Save PDF** (to `Documents/SCL Reports/YYYY/MM/<testno>-<NAME>.pdf`) · **WhatsApp** · **Email** — each logs to `delivery_log` with live status chips. All output disabled until Approved.

### 7.6 Patients / Search
Search by name (fuzzy), test_no, phone, date range, doctor. Row actions: open results, re-print, re-send, view bill, full visit history.

### 7.7 Test Master (Admin)
Table of all tests; filter by panel/enabled; `needs_review=1` rows highlighted yellow. Inline edit name/unit/price/decimals/sort; per-test range editor (multiple sex/age rows); panel manager; add-test wizard (unique code check); disable (not delete) once a test has results. **Every range/price edit audit-logged.**

### 7.8 Doctors
List + add/edit/deactivate; per-doctor referral counts and date-range collection.

### 7.9 Reports (business — mirrors old Reports menu)
Day-book (patient, billed/received/balance, day total) · Monthly summary · Doctor-wise referrals (Refer Cases Report) · Total Test Detail · Profit/Loss · Patient Test History · Pending balances. Export CSV.

### 7.10 Settings (Admin)
Lab identity (header lines, phones, timings, technician name, equipment line, footer tests line) · logo + signature image pickers · printer choice + test page · backup folders 1/2 + "Backup now" + restore wizard · SMTP fields + "send test email" · WhatsApp mode toggle + BSP key + template name + "send test message" · user management · `next_test_no` (guarded) · financial year (new-year rollover) · About/version + "Check for updates".

---

## 7A. EVERYTHING IS EDITABLE — convenient self-management (a core requirement)

The whole point of replacing CETEC is that the lab can manage its own data without ever calling a programmer. Nothing in the catalogue, the doctor list, the prices, or the report wording is hard-coded — it all lives in the database and is editable through plain screens. Edit permissions: **Admin can edit everything; Technician can only enter/approve results.** Every edit is audit-logged.

**What can be edited, and where:**

| Thing | Screen | Editable fields |
|---|---|---|
| **Tests** | Test Master (§7.7) | code, name, unit, decimals, **price**, panel, sort order, enable/disable, result type, choices list, default value, formula |
| **Reference ranges** | Test Master → range editor | low, high, range_text, separate rows per **Sex** (M/F/Any) and **age window**, multi-band text |
| **Interpretation/diagnosis notes** | Test Master → "Interpretation" tab | the full printed note per test/panel (§5.10) — free text |
| **Panels / groups** | Test Master → Panels | heading text, order, page-break-after, which tests belong |
| **Doctors** | Doctors (§7.8) | name, degree, active/inactive; add new inline from the receipt screen too |
| **Lab header & footer** | Settings (§7.10) | lab name, address, phones, timings, technician name, equipment line, the bottom "tests available" line, watermark on/off, bold-out-of-range on/off |
| **Logo & signature** | Settings | upload/replace **your father's signature image** and the SCL logo (image pickers) |
| **Prices in bulk** | Test Master | a "bulk price edit" mode: filter by panel, type new prices down a column, Save once |
| **Receipt-time overrides** | New Patient | per-patient price override + concession without changing the master price |

**UX rules that make it convenient (build these in):**
- **Inline editing**: click a cell (price/name/range), type, Enter to save — no separate popup for simple fields.
- **Search-as-you-type** across tests and doctors.
- **Undo/confirm** on destructive actions; you can never truly delete a test that already has patient results — only disable it (keeps old reports valid).
- **Add-new wizards** for test and doctor with duplicate-code/name checks.
- Changes apply immediately to **new** receipts; **already-billed** orders keep their frozen `price_charged` so historic bills never change.

## 7B. WhatsApp & Email auto-delivery — NEW features the old app never really had

The old CETEC app showed "Email / WhatsApp / Web Publish" labels but they were non-functional/basic. These are genuinely **new, working value-add buttons** on the Report Preview screen (§7.5), and a major reason to build this app:
- **WhatsApp** → sends the report PDF to the patient's own WhatsApp number (the number entered on the receipt). Semi-automatic first (one click), official API later (fully automatic). See §9 Phase 6.
- **Email** → emails the PDF to the patient's email. See §9 Phase 6.
- A Dashboard **"Waiting to send" tray** shows every approved report not yet delivered, so nothing is forgotten, with one-click send and a delivery-status log.
These never replace print — print stays exactly as today; WhatsApp/email are additions.

## 7C. Optional innovations (overview — full implementation detail in §15A)

You welcomed innovation but said speed/smoothness come first, so these are **off by default / opt-in** and none touch the core workflow's reliability:
- **ERBA H360 auto-import** (Phase 7) — CBC results flow straight from the analyzer; no typing 26 numbers.
- **QR code on every report** — scan to re-open/re-download at the lab.
- **Sample-tube barcode/QR printing** — matches tubes to patients; pairs with analyzer import.
- **"Smart entry" speed-ups** — Enter-through urine defaults; auto-calculated derived values; instant red flags.
- **Daily/monthly dashboards** — collection & referral bookkeeping at a glance.
- **One-click re-print / re-send**; **bulk WhatsApp resend** of a day's pending reports.
- **Auto-update** — push fixes to the lab PC remotely.
- *(Deliberately excluded: AI auto-diagnosis — unsafe, a doctor's job; cloud-only mode — you want offline.)*

Each of these is specified to build-level in **§15A**.

## 7D. COMPLETE UI SPECIFICATION (design system + every page, every button)

The old app's UI is the thing we are most replacing: cramped grey VB forms, tiny fonts, crowded toolbars. The new UI must be **modern, clean, calm, and instant**. This section specifies it down to button placement so the builder has no guesswork. Read it as the literal blueprint.

### 7D.1 Design principles (non-negotiable)
1. **Instant** — every screen paints in <16ms after data is ready; no spinner for local DB reads (SQLite is sub-millisecond). Navigation feels zero-latency. A skeleton shimmer only appears if a query somehow exceeds 150ms.
2. **Calm & uncluttered** — generous white space, one clear primary action per screen, never more than ~7 controls competing for attention.
3. **Big & legible** — base 16px, key numbers 18–20px; this lab serves older staff and the screens are read at arm's length.
4. **Keyboard-first** — every task completable without the mouse; visible focus ring; shortcuts shown as hints.
5. **Forgiving** — inline validation, confirmations on destructive actions, undo where possible, autosave drafts.
6. **Consistent** — one component library (shadcn/ui), one spacing scale, one color set; every list/table/form looks the same everywhere.

### 7D.2 Performance budget (how "superfast" is guaranteed, technically)
- **Tauri + Rust** core, **SQLite WAL** local file → reads are instant; no network on the hot path.
- **Cold start < 1.5s** to interactive (Tauri native window, no Electron bloat). Splash only if >800ms.
- **React with route-level code-splitting** (`React.lazy`) so each page's JS loads on first visit, then is cached; the shell + Dashboard bundle is tiny.
- **TanStack Query** caches DB results in memory; lists use **virtualization** (`@tanstack/react-virtual`) so a 5,000-patient table renders only visible rows.
- **Prepared statements + indexes** on `patients.test_no`, `patients.phone`, `patients.name`, `orders.patient_id`, `results.order_id`.
- **No layout shift**: fixed shell dimensions; images (logo/signature) have reserved boxes.
- **Debounced search** (120ms) but against in-memory cache so it feels live.
- Report preview renders in an **off-screen webview** kept warm, so opening Preview is instant.
- Animations: 120–160ms ease-out only (page fade, row hover); respect "reduce motion".

### 7D.3 Visual design system
- **Colors:** background `#FFFFFF` / surfaces `#F7F8FA` / borders `#E5E7EB`; text `#111827` (primary) / `#6B7280` (muted). **Brand maroon `#7B1B1B`** (from the SCL letterhead) for primary buttons, active nav, headings accents; **blue `#1E4FA3`** (the SCL logo blue) as secondary. Semantic: success `#15803D`, warning `#B45309`, danger `#B91C1C`, **out-of-range/high `#B91C1C` bold**, low `#1D4ED8`.
- **Typography:** UI font **Inter** (bundled, not web-loaded). Report font a serif close to the letterhead (bundled). Scale: 12 caption / 14 secondary / 16 body / 18 emphasis / 22 section title / 28 page title. Tabular numbers (`font-variant-numeric: tabular-nums`) for all result/price columns so digits align.
- **Spacing scale:** 4-8-12-16-24-32 px. Card padding 24. Page gutter 32.
- **Radius:** 10px cards/inputs/buttons, 8px chips. **Shadows:** subtle (`0 1px 2px rgba(0,0,0,.06)`); elevated dialogs `0 10px 30px rgba(0,0,0,.12)`.
- **Components (shadcn/ui):** Button (primary maroon / secondary outline / ghost / destructive), Input, Select/Combobox, Checkbox, RadioGroup, Switch, Table (sticky header, zebra optional, virtualized), Dialog, Sheet (side drawer), Toast (bottom-right, auto-dismiss 4s), Tabs, Badge/Chip (status), Tooltip, Command palette (Ctrl+K), Skeleton, EmptyState, Breadcrumb.
- **Status chips:** Registered (grey) → Results Pending (amber) → Approved (green) → Delivered (blue). Out-of-range value chips: **H** (red), **L** (blue), **A** (amber).

### 7D.4 App shell (every page lives inside this)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  h=56px  ░ (SCL logo 28px) Sharma Clinical Laboratory   [⌘K Search] │
│         right: ▸ date  ▸ user chip (name, role)  ▸ ⏻ logout                │
├───────────────┬──────────────────────────────────────────────────────────┤
│ SIDEBAR w=240 │  PAGE AREA  (max-width 1200, centered, 32px gutter)        │
│ collapsible→64│                                                            │
│  ◉ Dashboard  │   ┌ Page title (28px) ················ [primary action] ┐  │
│  ＋ New Patient│   │                                                     │  │
│  ☰ Patients   │   │   ... page content ...                              │  │
│  🧪 Test Master│   │                                                     │  │
│  👨‍⚕ Doctors    │   └─────────────────────────────────────────────────────┘  │
│  📊 Reports    │                                                            │
│  ⚙ Settings   │                                                            │
│  ───────────  │                                                            │
│  (bottom) ver │                                                            │
└───────────────┴──────────────────────────────────────────────────────────┘
```
- **Sidebar:** 240px, icon + label, active item has maroon left-bar + tinted background; collapses to 64px (icons only) via a chevron at bottom; **New Patient** is visually emphasized (filled maroon) because it's the most-used action. Keyboard: `g d`=Dashboard, `g n`=New, `g p`=Patients, etc. (vim-style "go" hints shown on hover).
- **Topbar:** left = logo + lab name; center-right = global **Command palette** trigger (Ctrl+K) — jump to any patient by name/test_no, any screen, any test; right = today's date, user chip (click → profile/password/logout).
- **Toasts** bottom-right; **confirm dialogs** centered modal.

### 7D.5 Page 1 — Login
Centered card (max 380px) on a soft maroon-tinted background with the SCL logo on top. Fields: Username, Password (show/hide eye). Primary button **Sign in** (full-width maroon). Below: small "v0.x.x" and lab name. Enter submits. Error: inline red text under the card. First-run: forces a "Set new password" step. No sidebar/topbar on this page.

### 7D.6 Page 2 — Dashboard
- Page title **Dashboard** (left), right: **＋ New Patient** (primary maroon).
- **Row of 4 stat cards** (equal width): Today's Patients · Reports Pending · Today's Collection ₹ · Balance Due ₹. Each = big number (28px) + label + tiny trend vs yesterday. Click a card → filtered Patients list.
- **Two-column body below:**
  - Left (60%): **Today's Patients** table — columns: Test No · Name · Tests (chips, truncated "+2") · Amount/Balance · **Status chip** · row-hover actions (Enter results ▸ / Print / Send). Rows clickable → Result Entry. Sticky header, virtualized.
  - Right (40%): **Waiting to Send** tray — cards of approved-but-undelivered reports, each with **WhatsApp** + **Email** + **Print** small buttons and a "delivered/failed" status line. Empty state: friendly "All caught up ✓".
- Quick actions strip under title: **New Patient · Today's List · Search (Ctrl+K) · Pending Results**.

### 7D.7 Page 3 — New Patient / Receipt  (the highest-traffic screen — optimized for speed)
Two-pane layout; the whole thing is completable with Enter only.
```
 Page title: New Patient                              [Save & Enter Results ⏎]
┌── LEFT: Patient (form, 1 col, large fields) ──┐ ┌── RIGHT: Tests & Bill ──────┐
│ Test No [4298] (read-only, grey)              │ │ Search test by code/name 🔍 │
│ Date/Time [auto] · Title [Mr.▾]               │ │ ───────────────────────────│
│ Name  [____________________]  (UPPERCASE)     │ │ Quick panels (chips):       │
│ Age [__] [YRS▾]   Sex ( )M ( )F ( )O          │ │ [CBC][LFT][KFT][LIPID][DIAB]│
│ Phone [__________] 📱  Email [__________]      │ │ [URINE][THYROID]            │
│ Ref By [search doctor ▾  ＋add]               │ │ ───────────────────────────│
│ Collected At [SHARMA CLINICAL LABORATORY]     │ │ Selected tests:             │
│ Address [____________________]                │ │  HB ............ ₹30   ✕    │
│                                               │ │  TLC ........... ₹30   ✕    │
│                                               │ │  Lipid Profile  ₹300   ✕    │
│                                               │ │ ───────────────────────────│
│                                               │ │ Total        ₹360           │
│                                               │ │ Concession  [₹/%  0]        │
│                                               │ │ Net          ₹360 (locked)  │
│                                               │ │ Received    [₹360]          │
│                                               │ │ Balance      ₹0   (locked)  │
│                                               │ │ Mode ( )Cash ( )UPI ( )Card │
└───────────────────────────────────────────────┘ └─────────────────────────────┘
 footer bar: [Print Receipt]   [Save (Ctrl+S)]            [Save & Enter Results ⏎]
```
- Test search dropdown shows code · name · price; Enter adds and refocuses the search (rapid multi-add). Selected tests animate in; ✕ removes. Adding a panel chip expands billing as one line.
- Out-of-the-way validation: red helper text under a field only after blur; the Save button stays enabled but Save surfaces the first error and focuses it.
- **Primary action top-right AND bottom-right** (both = "Save & Enter Results") so it's reachable without scrolling.

### 7D.8 Page 4 — Result Entry
- **Sticky header strip:** Test No · Name · Age/Sex · Ref By · **status chip**; far right **◀ Prev / Next ▶** patient + **Search**. Below it a thin progress bar (entered/total tests).
- **Body = panel sections** (cards), each card = panel heading + a table:
  `Test Name | Result (input) | Units | Normal Range`. Numeric inputs are wide and right-aligned (tabular nums); when a value goes out of range the **row turns red, value bold, H/L chip appears** instantly. Choice fields = dropdown with default preselected (Enter-Enter-Enter flies through urine). Calculated rows are grey, auto-filled, with a tiny "auto" tag.
- **Comments** card at the bottom (multiline).
- **Footer action bar (sticky):** left **Save Draft** (auto-saves every change anyway) · right **Approve (F9)** (green, prominent). Approve opens a confirm dialog listing any blank tests with "mark not done" toggles. After approval the inputs lock and a **Go to Report ▸** button appears.

### 7D.9 Page 5 — Report Preview & Output
- Split view: **left = live A4 preview** (the exact letterhead, zoom 75/100/125%, page nav if multi-page); **right = action panel**: big buttons stacked — **🖨 Print** · **📄 Save PDF** · **🟢 WhatsApp** · **✉ Email**; below them toggles (Page break per panel, Signature on/off, Watermark on/off); below that a **Delivery log** list (channel · target · status · time).
- All four output buttons are **disabled with a tooltip** ("Approve the report first") until approved.
- Top-right: **Back to Results** and **Re-print** (for past reports opened from search).

### 7D.10 Page 6 — Patients (search & history)
- Top: **filter bar** — search box (name/test_no/phone), date range, doctor select, status select; results count.
- **Virtualized table:** Date · Test No · Name · Age/Sex · Doctor · Tests · Amount/Balance · Status · actions (Open · Re-print · Re-send). Click row → opens that patient (Result Entry if pending, Report if approved). Empty state with a "New Patient" CTA.
- Clicking a name → side **Sheet** with full visit history (all past receipts/reports for that name+phone).

### 7D.11 Page 7 — Test Master (editable catalogue)
- Left rail: **panel filter** (HEM/BIO/LFT/…/All) + "needs review" toggle (shows yellow-flagged rows).
- Main: **editable table** — Code · Name · Unit · Price · Type · Enabled. **Inline edit** (click cell → edit → Enter). Top-right: **＋ Add Test**, **Bulk Price Edit** (turns the price column into editable inputs, one Save), **Manage Panels**.
- Click a row → **side Sheet** with tabs: *Details* (all fields), *Ranges* (per-sex/age rows, add/remove), *Interpretation* (the printed note textarea). Save per sheet. Disabled tests greyed; delete blocked if results exist (tooltip explains).

### 7D.12 Page 8 — Doctors
Simple table: Name · Degree · Referrals (count) · Active toggle · Edit. Top-right **＋ Add Doctor**. Inline edit. Click → small dialog with date-range referral/collection summary.

### 7D.13 Page 9 — Reports (business)
Tabs: **Day Book · Monthly · Doctor-wise · Test-wise · Pending Balances**. Each = filter bar (date range etc.) + table + totals row + **Export CSV** button. Charts optional (a simple bar for monthly collection) but secondary.

### 7D.14 Page 10 — Settings
Vertical tabbed layout (left tab list, right panel): **Lab Identity** (header/footer text fields with a live mini-preview) · **Branding** (logo + **father's signature** upload, drag-drop, shows current image) · **Printing** (printer select, test page, margins) · **Backups** (folder 1, folder 2/Drive, retention, Backup now, Restore wizard) · **Email (SMTP)** (fields + Send test) · **WhatsApp** (mode toggle semi/API, BSP key, template, Send test) · **Users** (table, add/reset password, roles) · **System** (next test no, financial year, version, Check for updates). Each tab saves independently with a toast.

### 7D.15 Global states & polish
- **Empty states** everywhere (illustration + one-line + CTA), never a blank screen.
- **Errors** as inline messages or toasts, never raw stack traces; a "Report a problem" copies a log.
- **Loading**: skeletons matched to final layout (no spinners-of-doom); because data is local they rarely show.
- **Offline indicator**: a tiny dot in the topbar — green (all local features working) / amber (no internet → WhatsApp-API/email queued). Core work never blocks on it.
- **Confirmations**: destructive = red dialog with the item named; approve = summary dialog.
- **Accessibility**: full keyboard, focus rings, ARIA labels, 4.5:1 contrast, "reduce motion" honored.
- **Density toggle** (Comfortable/Compact) in Settings for power users.

## 8. Report engine — EXACT reproduction of the SCL letterhead

Recreated **pixel-faithfully** from the 7 scanned report PDFs (rendered at `/Users/namansharma/Downloads/Lab App/_pdfimg/r1–r7.png`) as `src/report/template.html` + `report.css` (A4 portrait, ~12mm margins, print `@page`). The text below is transcribed **verbatim** from the real reports — reproduce it exactly. Every literal string here is also stored in `settings`/the interpretation library (§5.10) so it can be edited later without code changes.

### 8.1 Header (identical on every report)
- Top-left: **SCL** logo (circular, blue). Beside it, very large bold maroon: **SHARMA CLINICAL LABORATORY**.
- Boxed line under the name: **FULLY COMPUTERISED HI-TECH LAB.**
- Top-right block (right-aligned): **G.T. ROAD, VILLAGE NANGAL BHUR, TEH. & DISTT. PATHANKOT**.
- Left, blue bold: **Mob : 9646778583** / **9464148746**.
- Center: **Timing : Summer - 7:30 am to 9:00 pm** / **Winter - 8:15 am to 7:30 pm**.
- Right, italic script: **Rajesh Kumar (Vicky)** with **DMLT (PTU)** beneath.
- Full-width maroon-bordered strip (bold): **Equipped With ERBA H360 Blood Cell Counter, ERBA CHEM-5 PLUS Vz, EBRA Semi Auto Analyser, CHEM-7 & STAR 21 Semi Auto Analyser, Uri-plus 200 Urine Chemistry Analyser, Qua-lab Hba1c Analyser.**

### 8.2 Patient block (boxed, two columns)
Left column: **Name** · **Age/Gender** · **Collected AT** · **Referred By**.
Right column: **Test Request ID** · **Sample Collected ON** · **Sample Received ON** · **Report DATE**.
(The analyzer/CBC variant labels the left as **Patient ID / Name / Ref By** and the right as **Date / Age:Sex / Address** — support both header variants; default to the boxed four-line version seen on the biochemistry reports.)

### 8.3 Section headings & table
Centered, bold heading per panel: **HEMATOLOGY**, **BIOCHEMISTRY**, **CBC (COMPLETE BLOOD COUNT)**, **URINE EXAMINATION**, etc. Then a 4-column table with headers **Test Name | Results | Units | Normal Ranges**. Out-of-range numeric results are printed (the lab prints them plainly; we **bold** them — keep a settings switch to disable bolding if your father prefers the plain look). A single report can stack multiple panels (e.g. HB under HEMATOLOGY then Glucose under BIOCHEMISTRY, as in report r3).

### 8.4 CBC layout (report r1/r2) — exact parameters, sections & ranges
Three sub-sections with the **WBC / RBC / PLT histogram images** printed on the right (from the H360):
- **LEUKOCYTES:** WBC (TLC) `/cumm` 4000–11000 · DLC · Lymphocyts `%` 20.0–40.0 · Mid `%` 2.0–10.0 · Neutrophils `%` 40.0–70.0 · Lym# `10^3/uL` 1.10–3.20 · Mid# `10^3/uL` 0.10–0.60 · Gran# `10^3/uL` 1.80–6.30
- **ERYTHROCYTES:** HGB `g/dl` 12.0–17.5 · RBC `10^6/uL` 3.80–5.80 · MCV `fl` 82.0–100.0 · HCT `%` 40.0–50.0 · MCH `pg` 27.0–34.0 · MCHC `g/dl` 31.6–35.4 · RDW-SD `%` 35.0–56.0 · RDW-CV `fl` 11.0–16.0
- **THROMBOCYTES:** PLT `/cumm` 150000–450000 · MPV `fl` 6.5–12.0 · PCT `%` 0.108–0.282 · PDW-SD `fl` 9.0–17.0 · PDW-CV `%` 10.0–17.9 · P-LCR `%` 11–45 · P-LCC `10^3/uL` 30–90

### 8.5 LFT layout (report r6) — exact rows & ranges (under BIOCHEMISTRY → "LIVER FUNCTION TEST (LFT)")
Glucose (Random) `mg/dl` 70.0–150.0 · S. Bilirubin Total 0.30–1.20 · S. Bilirubin Direct < 0.30 · S. Bilirubin Indirect < 0.80 · SGOT (AST) `U/L` < 40 · SGPT (ALT) `U/L` < 40 · S. Alkaline Phosphatase (ALP) `IU/l` 108.0–306.0 · S. Gamma Glutamyl Transferase (GGT) `U/L` 10.0–50.00 · Total Protein `g/dL` 6.40–8.30 · Serum Albumin `g/dL` 3.50–5.20 · Serum Globulin `g/dL` 1.9–3.7 · A : G Ratio 0.90–2.00.

### 8.6 Footer (identical on every report)
- Right: father's **signature image** above the printed line **Lab Technician**.
- Center (when report complete): **\*\*\* End Of Report \*\*\***.
- Bottom-left: **NOT FOR MEDICO LEGAL PURPOSE**.
- Bottom-right: **ALL TEST ARE AVAILABLE HERE**.
- Final centered footer line (small): **T3, T4, TSH (THYROID), LH, FSH, PROLACTIN, TESTOSTERONE, ESTRADIOL, LFT, LIPID PROFILE, KIDNEY FUNCTION TEST'S CULTURES, MALARIA ANTIGEN, TYPHOID ANTIBODIES TESTS AVAILABLES**.
- Add (new, small, bottom corner): **QR code** encoding test_no + name + report date for instant lookup/re-print.

### 8.7 Rendering rules
- `renderReport(patientId)` → validated data → filled HTML; refuses (visible error, no output) on missing/unapproved results or sample-ID mismatch.
- **Print and Save-PDF call the same function** so paper and PDF can never differ.
- Multi-page: optional page-break-per-panel (old "PAGE BREAK"); the full header repeats on every page; widow/orphan control so a heading never strands at a page bottom.
- A faint diagonal **"SHARMA CLINICAL LABORATORY" watermark** (as seen on the originals) behind the body — toggle in Settings.

---

## 8A. BACKEND — full implementation spec (Rust/Tauri + the data-access layer)

In a Tauri app there are two "backends": (1) the **Rust core** (does the few things JS can't — SMTP, raw filesystem, the analyzer socket, OS printing) and (2) the **TypeScript data-access layer** (`lib/queries/*`) that holds all business logic and DB access. We keep Rust deliberately thin so a beginner can maintain the app. This section pins down both.

### 8A.1 Architecture & data flow
```
React page → TanStack Query hook → lib/queries/<entity>.ts → lib/db.ts (SQLite plugin)
                                          │
                                          └─ for OS-level needs → invoke('<command>') → Rust command → result
```
- **DB access** goes through the `@tauri-apps/plugin-sql` plugin from TypeScript — no Rust needed for normal CRUD. All SQL lives in `lib/queries/*` as prepared statements.
- **Rust commands** are only invoked for: send_email, filesystem backup/restore, silent printing, ASTM listener (Phase 7), secret encryption. Everything else is TS.
- **No business logic in React components** — components call query hooks; hooks call query modules; query modules enforce rules (role checks, transactions, audit writes).

### 8A.2 The full Rust command surface (`src-tauri/src/commands/`)
| Command | Args | Returns | Notes |
|---|---|---|---|
| `send_email` | to, subject, body_html, pdf_path | ok/err | `lettre` SMTP; creds from encrypted settings; 10s timeout; never blocks UI |
| `backup_now` | db_path, dest1, dest2 | {ok, sizes} | checkpoint → copy → integrity_check → prune (§4A.8) |
| `restore_backup` | backup_path | ok/err | integrity-check → swap → reopen |
| `print_html` | html, printer?, silent | ok/err | renders report HTML to default/named printer |
| `save_pdf` | html, out_path | path | same renderer → PDF (identical output) |
| `encrypt_secret` / `decrypt_secret` | plaintext / cipher | string | OS keychain or AES key in app-data for SMTP/BSP keys |
| `astm_start` / `astm_stop` | port | status | (Phase 7) opens TCP listener, emits events to JS |
| `reveal_in_folder` | path | ok | for WhatsApp-semi (show the PDF to drag) |
| `app_version` / `check_update` | — | info | wraps updater plugin |
Each command: validates inputs, returns a typed `Result`, logs errors to a rolling app log; **never panics** (all `?`/`map_err` to a friendly message surfaced as a toast).

### 8A.3 The TypeScript data-access layer (`lib/queries/*` — one module per entity)
Each module exports typed functions; **every mutating function runs in a transaction and writes an audit row**. Representative surface:
- `patients.ts`: `create(patientWithOrdersAndBill)` (the big receipt transaction §4A.7), `update`, `search(filters)`, `getById`, `todayList()`, `history(name,phone)`.
- `tests.ts`: `list(filter)`, `upsert(test)`, `setEnabled`, `bulkUpdatePrices(rows)`, `addRange/updateRange/deleteRange`, `setInterpretation` — all Admin-gated.
- `orders.ts` / `results.ts`: `loadForPatient(id)`, `saveResult(orderId,value)` (computes flag via `flags.ts`, recomputes calculated siblings via `calc.ts`), `approve(patientId)` (transaction §4A.7), `unlock(orderId,reason)` (Admin).
- `bills.ts`: `get/update` (net/balance are generated columns — never set directly).
- `doctors.ts`: `list/upsert/setActive`, `referralSummary(id,range)`.
- `delivery.ts`: `log(entry)`, `pendingToSend()`, `markStatus`.
- `reportsBiz.ts`: `dayBook`, `monthly`, `doctorWise`, `testWise`, `pendingBalances` (date-range aggregates).
- `settings.ts`: `get(key)`, `set(key,val)` (secrets via encrypt command), `nextTestNo()` (atomic bump inside the receipt transaction).
- `audit.ts`: `write(action, entity, id, before, after)` — called inside other transactions, never standalone-skippable.

### 8A.4 Role enforcement (defense in depth)
- `lib/session.ts` holds the logged-in user + `can(action)` helper. UI hides controls the role can't use (Technician sees no price/range edit, no Settings, no unlock).
- **But** the query layer **re-checks** the role server-side-style before every privileged mutation (`tests.upsert`, `unlock`, `settings.set`, user management) and throws if not allowed — so a hidden button can never be the only guard.
- Passwords: **argon2id** hash (via a small Rust command or a vetted JS argon2 wasm); never store plaintext; login lockout after 5 fails (tracked in `users`/memory).

### 8A.5 Result-flagging & calculation engine (hot path, pure TS, unit-tested)
- `flags.ts.computeFlag(test, value, patientSexAge)` → picks the matching `test_ranges` row by sex+age, parses numeric value, returns `''|'H'|'L'` (or `'A'` for qualitative ≠ normal). Handles `<x`/`>x` style ranges and Indian number formats ("1,68,000").
- `calc.ts` formulas (§6) run after each numeric save and on load; a dependency map (e.g. VLDL depends on TG) recomputes only affected calculated rows. Division-by-zero/missing → blank.
- Both run in <1ms; results cached by TanStack Query so the UI updates instantly.

### 8A.6 Printing & PDF pipeline (paper = PDF = preview, guaranteed)
- `report/render.ts` builds the final HTML from `template.html` + partials + data.
- Preview = that HTML in an off-screen webview (kept warm).
- **Print** and **Save PDF** both hand the **same HTML** to the Rust `print_html`/`save_pdf` commands → so there is physically one rendering path. A4 `@page` CSS controls margins; fonts are bundled (no web fetch) so output is deterministic across machines.

### 8A.7 Email engine
- Rust `send_email` via `lettre` over the lab's Gmail SMTP (app-password). Body = a small SCL-styled HTML; the report PDF attached. Per-patient optional; blocked unless approved + email present; every attempt logged in `delivery_log` (queued→sent/failed with error text). Retry from the dashboard tray.

### 8A.8 WhatsApp engine (two modes, one interface in `lib/whatsapp.ts`)
- **Semi mode:** ensure PDF saved → build message text → `open(https://wa.me/91<phone>?text=<encoded>)` via shell plugin → `reveal_in_folder(pdfPath)` so the user drags the file once → log as `whatsapp_semi/queued`. (No API, no cost, no ban risk.)
- **API mode:** POST to the BSP (AiSensy/Interakt) REST endpoint with the approved utility template + the PDF as a document header; store message id; update status from webhook (or poll). Switch is a single `settings.whatsapp_mode` flag. Send blocked unless approved + valid 10-digit phone.

### 8A.9 Error handling, logging, resilience
- A rolling log file in app-data (`logs/app-YYYY-MM-DD.log`, 14-day keep) captures errors + key events (NOT patient data beyond ids). Settings → "Report a problem" zips recent logs.
- Every Rust command and every query mutation returns typed errors → surfaced as a toast with a plain-English message; the app never shows a raw stack trace or crashes to desktop.
- Startup self-check: DB opens, migrations applied, `integrity_check` ok, backup dirs writable, printer reachable → a one-time "System OK" indicator; any failure shows a guided fix.

### 8A.10 Security & privacy posture
- Fully offline by default; the only outbound calls are SMTP, the BSP API (if enabled), and GitHub for updates — all to endpoints you control/trust.
- Secrets (SMTP password, BSP key) encrypted at rest (§8A.2). DB file sits in the user's app-data; recommend OS-level disk protection on the lab PC. Tauri allowlist/capabilities restrict the app to only the FS paths and plugins it needs (no arbitrary shell).

## 9. Phase-by-phase build (commands, files, gates)

> Rhythm per phase: Claude codes → app runs on Mac (`npm run tauri dev`) → you run the gate checklist → git commit + push → next phase. One feature branch per phase.

### Phase 0 — Workshop (~½ day)
1. `brew install node`; install Rust via rustup; `npm create tauri-app@latest scl-lab-app` (React-TS) in `~/Projects/scl-lab-app`.
2. Add Tailwind + shadcn/ui; add plugins `@tauri-apps/plugin-sql`, `-printing`, `-updater`, `-fs`, `-shell`.
3. Create GitHub account (yours) + private repo `scl-lab-app`, initial push. Create Google account/folder for Drive backups.
4. **Gate G0:** branded empty window runs from `npm run tauri dev`; repo on GitHub.

### Phase 1 — Database + seed catalogue (~1 week)
1. Migration `0001_init.sql` (all §4 tables) + runner.
2. `src/lib/db.ts` (typed queries); `src/lib/calc.ts` + Vitest tests for every §6 formula; `src/lib/flags.ts` + tests (sex/age range matching; qualitative flagging).
3. Build `seed/catalogue.csv`, `seed/ranges.csv`, `seed/doctors.csv` from §5; load via `0002_seed.sql`. Mark `⚠price`/unsourced ranges `needs_review=1`, enabled.
4. **Gate G1:** `npm test` green; spot-check 20 tests against §5 (HB shows M/F ranges; Creatinine 0.60–1.20; URINE components show the right choices + defaults; CBC expands to sub-params; a package expands to children).

### Phase 2 — Core screens (~2–3 weeks)
Order: Login → New Patient/Receipt → Test Master → Result Entry → Dashboard → Patients/Search → Doctors → Reports(business) → Settings. Receipt print (A5/thermal). Audit logging on all writes.
**Gate G2 (break-it day):** register→results→approve a patient **keyboard-only** in <2 min · age 250 blocked · concession>total blocked · edit-after-approve needs Admin unlock + shows in audit log · force-quit mid-save → reopen → no half-saved patient (transaction proof) · Technician cannot edit ranges/prices · urine Enter-through-defaults works · package expands correctly and bills as one line.

### Phase 3 — Report engine (~1–2 weeks)
Template §8 · preview · Print + Save-PDF (identical) · QR · re-print from Patients.
**Gate G3 — the 10-report gate (master correctness test):** re-enter 10 real past patients from the report PDFs (CBC, LFT, lipid, glucose/HbA1c, KFT, urine) → print → physically overlay on the originals: every value, unit, range string, bold flag, heading, note, footer line matches. **No progress past G3 until perfect.**

### Phase 4 — Safety net (~3–4 days)
Daily dual backup (first launch of the day + 9pm timer; catch-up if missed; prune >30 days) · restore wizard · encrypted secrets.
**Gate G4 (fire drill):** copy yesterday's backup to another machine, open in app, all patients present · pull USB mid-backup → clear error, primary DB intact · audit log complete for a full patient lifecycle.

### Phase 5 — Windows build + lab install (~2–3 days)
1. `.github/workflows/release.yml` with `tauri-action`: tag `v*` → Windows NSIS installer + updater JSON/signatures to GitHub Releases. `tauri signer generate` keypair → private key in GitHub secrets **+ offline backup**.
2. Tag `v0.1.0` → install on lab PC → configure printer/backup dirs/users; set `next_test_no` to continue the old app's sequence (old app was at ~4298 on 11/06/2026 — read the lab's current last receipt at install time and set this).
3. **Parallel run starts:** old + new app side-by-side daily; new app becomes source of truth only after 1–2 clean weeks + father's sign-off.
4. **Gate G5:** installer installs clean on lab PC · real printer output matches Mac output · tag `v0.1.1` with a visible tweak → lab PC auto-updates.

### Phase 6 — Delivery (~1 week)
1. **Email:** `lettre` SMTP command; lab Gmail app-password; SCL-styled body + PDF attach; per-patient toggle; delivery_log.
2. **WhatsApp semi:** ensures PDF saved → composes message → opens `wa.me/91<phone>` → reveals PDF for one-drag attach → log. Message: *"Dear {title} {name}, your report ({tests}) from SHARMA CLINICAL LABORATORY, Nangal Bhur is ready. PDF attached. — Rajesh Kumar (Vicky), DMLT"*.
3. **WhatsApp API mode:** AiSensy/Interakt onboarding (lab business number, Meta verification 1–3 days, one utility template with document header = the PDF) → app calls BSP REST on approve (auto-send toggle) → webhook→polling status → delivery_log. Settings toggle semi/API; send blocked unless Approved + phone present.
4. **Gate G6:** real report to your own WhatsApp + email in both modes · unapproved report unsendable · missing phone → clear message · failures land in the dashboard tray for retry.

### Phase 7 — ERBA H360 auto-import (optional, ~1–2 weeks)
H360 LIS mode → lab-PC IP:port; Rust TCP listener speaking **ASTM E1381/E1394** (ENQ/ACK framing, checksums); parse R-records → map analyzer codes (WBC, LYM%, HGB…) to our CBC test codes; match `sample_id` ↔ patient → results land **pending** (never auto-approved); no match → **holding queue** screen for the technician (never guess-attach); optional tube-label barcode printing.
**Gate G7:** a real CBC run lands on the right patient with zero typing · unknown sample ID queues safely · histograms print on the CBC report.

---

## 10. Project structure (fully expanded — every file the builder creates)

```
scl-lab-app/
├── package.json                       # scripts: dev, build, tauri, test, lint
├── vite.config.ts                     # Vite + React + path aliases (@/…)
├── tailwind.config.ts                 # design tokens (colors §7D.3, spacing, radius)
├── postcss.config.js
├── tsconfig.json
├── components.json                    # shadcn/ui config
├── index.html
├── README.md                          # setup, build, updater-key handling, this plan linked
│
├── src/                               # ── FRONTEND (React + TypeScript) ──
│   ├── main.tsx                       # app entry; mounts <App/>, QueryClient, router
│   ├── App.tsx                        # router + <AppShell> + auth guard
│   ├── routes.tsx                     # route table; React.lazy() per page (code-split)
│   │
│   ├── app/                           # shell & cross-cutting UI
│   │   ├── AppShell.tsx               # topbar + sidebar + <Outlet/> (§7D.4)
│   │   ├── Sidebar.tsx                # nav items, collapse, active state, "g" shortcuts
│   │   ├── Topbar.tsx                 # logo, lab name, Ctrl+K trigger, user chip, offline dot
│   │   ├── CommandPalette.tsx         # Ctrl+K: jump to patient/screen/test
│   │   ├── AuthGuard.tsx              # redirects to /login if no session
│   │   └── KeyboardShortcuts.tsx      # global hotkeys (Ctrl+N/F/P, F9, g-nav)
│   │
│   ├── pages/                         # one folder per screen (§7D.5–7D.14)
│   │   ├── login/LoginPage.tsx
│   │   ├── dashboard/DashboardPage.tsx
│   │   │        ├── StatCards.tsx  TodayPatientsTable.tsx  WaitingToSendTray.tsx
│   │   ├── new-patient/NewPatientPage.tsx
│   │   │        ├── PatientForm.tsx  TestPicker.tsx  PanelChips.tsx  BillingPanel.tsx
│   │   ├── result-entry/ResultEntryPage.tsx
│   │   │        ├── PatientHeaderStrip.tsx  PanelSection.tsx  ResultRow.tsx
│   │   │        ├── ApproveDialog.tsx  CommentsCard.tsx
│   │   ├── report/ReportPreviewPage.tsx
│   │   │        ├── ReportFrame.tsx (off-screen webview)  OutputActions.tsx  DeliveryLog.tsx
│   │   ├── patients/PatientsPage.tsx
│   │   │        ├── PatientFilters.tsx  PatientsTable.tsx (virtualized)  HistorySheet.tsx
│   │   ├── test-master/TestMasterPage.tsx
│   │   │        ├── TestTable.tsx  BulkPriceEdit.tsx  TestSheet.tsx (Details/Ranges/Interp tabs)
│   │   │        ├── RangeEditor.tsx  PanelManager.tsx  AddTestWizard.tsx
│   │   ├── doctors/DoctorsPage.tsx
│   │   ├── reports/BizReportsPage.tsx # tabs: DayBook Monthly DoctorWise TestWise Pending
│   │   └── settings/SettingsPage.tsx
│   │            ├── LabIdentityTab.tsx  BrandingTab.tsx (logo + signature upload)
│   │            ├── PrintingTab.tsx  BackupsTab.tsx  EmailTab.tsx  WhatsAppTab.tsx
│   │            └── UsersTab.tsx  SystemTab.tsx
│   │
│   ├── components/ui/                 # shadcn/ui primitives (button, input, table, dialog,
│   │                                  #  select, combobox, tabs, sheet, toast, badge, …)
│   ├── components/common/             # StatusChip, FlagChip(H/L/A), MoneyInput,
│   │                                  #  SearchBox, EmptyState, ConfirmDialog, PageHeader
│   │
│   ├── lib/                           # ── logic (pure where possible, unit-tested) ──
│   │   ├── db.ts                      # typed SQLite access (prepared statements)
│   │   ├── queries/                   # one module per entity: patients.ts tests.ts
│   │   │                              #  orders.ts results.ts bills.ts doctors.ts
│   │   │                              #  delivery.ts reportsBiz.ts settings.ts audit.ts
│   │   ├── calc.ts                    # derived-value formulas (§6) + calc.test.ts
│   │   ├── flags.ts                   # range/flag logic (§4.5) + flags.test.ts
│   │   ├── validation.ts             # field rules (age, phone, concession) + tests
│   │   ├── audit.ts                   # writeAudit(action, entity, before, after)
│   │   ├── backup.ts                  # daily dual backup + restore + retention
│   │   ├── whatsapp.ts                # semi (wa.me) + api (BSP) senders
│   │   ├── email.ts                   # invokes Rust smtp command
│   │   ├── printing.ts                # print + save-pdf via report webview
│   │   ├── qr.ts                      # QR generation for report footer
│   │   ├── format.ts                  # date/number/currency formatting
│   │   └── session.ts                # current user, role checks (can(role,'edit_price'))
│   │
│   ├── report/                        # ── the SCL letterhead (single source for paper/PDF/preview)
│   │   ├── template.html              # exact header/body/footer (§8)
│   │   ├── report.css                 # A4 @page, fonts, columns, watermark, bold-flag
│   │   ├── render.ts                  # renderReport(patientId) contract (§8.7)
│   │   └── partials/                  # header.html patientBlock.html cbcSection.html
│   │                                  #  panelTable.html interpretation.html footer.html
│   │
│   ├── store/                         # TanStack Query keys + small UI state (Zustand)
│   ├── styles/                        # globals.css, tokens.css, print.css
│   ├── assets/fonts/                  # Inter (UI) + serif (report) — bundled, not web-loaded
│   └── types/                         # shared TS types (Patient, Test, Order, Result, …)
│
├── src-tauri/                         # ── BACKEND (Rust, kept minimal) ──
│   ├── tauri.conf.json                # window, bundle (NSIS), updater endpoint, allowlist
│   ├── Cargo.toml
│   ├── build.rs
│   ├── icons/                         # app icons
│   ├── capabilities/                  # plugin permissions (sql, fs, shell, printing, updater)
│   ├── migrations/
│   │   ├── 0001_init.sql              # all §4 tables + indexes
│   │   └── 0002_seed.sql             # loads seed/* (catalogue, ranges, doctors, interpretations)
│   └── src/
│       ├── main.rs                    # Tauri builder, register plugins + commands
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── smtp.rs                # send_email() via lettre
│       │   ├── backup.rs              # filesystem copy helpers
│       │   └── astm.rs                # (Phase 7) ERBA H360 TCP/ASTM listener
│       └── lib.rs
│
├── seed/                              # editable source data (→ 0002_seed.sql)
│   ├── catalogue.csv                  # tests (§5.2–5.7)
│   ├── ranges.csv                     # reference ranges (§5)
│   ├── doctors.csv                    # referrers (§5.8)
│   └── interpretations.csv            # diagnosis notes (§5.10)
│
├── assets/                            # logo.png, signature.png (placeholders until uploaded)
│
├── tests/                             # Vitest unit + a few Playwright-style smoke tests
│   └── e2e/ register-approve-print.spec.ts
│
└── .github/workflows/
    └── release.yml                    # tauri-action: tag v* → Windows NSIS + updater artifacts
```

**Why this structure helps the build:** each page is a self-contained folder (so Claude can build/test one screen at a time per Phase 2's order), all DB access is funneled through `lib/queries/*` (so the integrity rules in §4.14 live in one place), and the report is isolated in `src/report/` (so the §8 letterhead can be perfected against the 10-report gate without touching app logic).

---

## 11. Risk register (known pitfalls, pre-answered)

| Risk | Mitigation |
|---|---|
| Report layout drifts from original | G3 overlay test; single render function for print+PDF; template version-controlled |
| Wrong reference range ships | §5 ranges seeded; `needs_review` rows flagged yellow; range edits Admin-only + audit-logged; medically-critical ranges (Creatinine/HB/Bili/Platelets/urine) are screenshot-confirmed |
| Result on wrong patient | Single-patient render contract; FK chain; refuse-on-mismatch; H360 holding queue |
| Disk death / data loss | Dual daily backups + 30-day retention + G4 fire drill on another machine |
| Tauri/Rust friction for a beginner | Rust limited to plugins + 2 small commands (SMTP, ASTM); all logic in TS |
| Mac→Windows surprises (fonts, printers) | CI Windows builds from Phase 5; G5 real-printer comparison; bundle report fonts |
| WhatsApp account ban | Semi mode = official app, manual send; API mode = official Meta channel; never grey-market libraries |
| Catalogue price errors (OCR conflicts) | `⚠price` rows flagged; Admin edits in seconds in Test Master; prices never block operation |
| Old-app cutover chaos | Parallel run 1–2 weeks; `next_test_no` continues old sequence; old app kept read-only |
| Lost updater key | Generated once → GitHub secrets + offline copy; documented in README |

---

## 12. Verification master checklist ("flawless" = all of these)
1. Gates G0–G6 passed (G7 if analyzer phase done) — each a written checklist you run on real hardware.
2. **G3 10-report gate** passed with physical overlay on real reports.
3. Break-it suite (G2) and backup fire-drill (G4) passed.
4. `npm test` green: every §6 formula and §4.5 flag rule has a unit test.
5. Two clean weeks of parallel run at the lab; father signs off; old app retired to read-only archive.

## 13. Your personal (non-coding) job list
1. Provide clean scans: SCL logo + technician signature (one time).
2. Create GitHub + Google accounts (Phase 0); lab Gmail app-password (Phase 6); for API WhatsApp: lab business number + Meta verification via AiSensy/Interakt.
3. Run each gate checklist (you are QA).
4. Optional one-time glance at the printed `needs_review` price/range list — fix any in Test Master (no father dictation needed; catalogue already loaded).
5. Cash cost ≈ ₹0 until WhatsApp API (~a few hundred ₹/month).

**Timeline (part-time, with Claude coding): Phases 0–5 ≈ 5–8 weeks to lab install; +1 week delivery; analyzer optional later. First thing to show your father: end of Phase 2 (~3–4 weeks in).**

---

## 15A. INNOVATIONS — full implementation detail

Each innovation below is specified so the builder can implement it on its own branch, behind a Settings toggle, without risking the core. Order = value-for-effort.

### 15A.1 ERBA H360 analyzer auto-import (the flagship — Phase 7)
- **Goal:** eliminate manual typing of ~26 CBC numbers per patient (slow + the biggest source of transcription error).
- **Transport:** the H360 has a LAN/serial LIS port speaking **ASTM E1381 (low-level framing: ENQ/ACK/STX/ETX, checksums) + E1394 (record types H/P/O/R/L)**. Configure the analyzer's "Host/LIS" settings to point at the lab-PC IP and a chosen TCP port.
- **Listener:** Rust `commands/astm.rs` opens a TCP server on that port, implements the ENQ/ACK handshake, accumulates frames, validates checksums, and parses **R (result) records** into `{analyzer_code, value, unit, flags, sample_id}`. Emits a Tauri event `astm:result` to the JS layer.
- **Mapping:** a `analyzer_map` table/CSV maps H360 codes (WBC, LYM%, HGB, MCV, PLT, …) → our CBC test codes. Histogram blobs (WBC/RBC/PLT) saved as images for the report.
- **Matching & safety:** match incoming `sample_id` ↔ patient (sample_id = test_no/barcode). On match → results land **pending review** (NEVER auto-approved). On no/ambiguous match → a **Holding Queue** screen where the technician claims the run to the right patient or discards it. The app never guesses a patient.
- **Toggle:** Settings → an "Analyzer" tab (port, mapping, start/stop, connection indicator, last-received log).
- **Gate G7** (already in §9): real CBC lands on the right patient with zero typing; unknown sample queues; histograms print.

### 15A.2 QR code on every report
- `lib/qr.ts` generates a QR (offline lib) encoding `test_no|name|report_date` (no sensitive data). Printed small in the footer (§8.6).
- Scanning it in the app's Ctrl+K search (or a phone that hits a future local lookup) opens that exact report for instant re-print. Pure offline; zero dependency.

### 15A.3 Sample-tube barcode/QR labels
- Optional small label printer (or plain sticker sheet): on Save Receipt, print a label with patient name + **barcode of sample_id**. The H360/scanner reads it → seamless §15A.1 matching. Implemented via the same `print_html` command with a label-sized `@page`. Off unless a label printer is configured.

### 15A.4 Smart result entry (built into Phase 2, always on — pure speed)
- Urine/qualitative panels pre-fill `default_value`; pressing Enter accepts and advances → a full urine report entered in seconds.
- Calculated values (§6) auto-fill live; out-of-range turns the row red+bold instantly (§7D.8).
- "Copy from previous visit" button on Result Entry pre-loads a returning patient's last values as a starting point (editable) — handy for monitoring cases.

### 15A.5 Business intelligence dashboards
- The §7.9 business reports plus a simple monthly-collection bar and doctor-referral leaderboard on the Dashboard (read-only aggregates; cached; no heavy charting lib — a tiny SVG bar).

### 15A.6 Delivery automation niceties
- **Bulk send:** Dashboard "Waiting to Send" tray → "Send all" (semi mode opens each WhatsApp in turn; API mode sends silently).
- **Auto-send on approve** (API mode only, opt-in): approving a report immediately queues WhatsApp + email.
- **Delivery retry:** failed sends stay in the tray with the error and a Retry button.

### 15A.7 Auto-update channel
- `release.yml` publishes signed updater artifacts; the app checks GitHub Releases on launch (and via Settings → Check for updates) and applies updates in the background → you fix bugs/add tests remotely, the lab PC just gets them. Updater public key in the app; private key in GitHub secrets + offline backup.

### 15A.8 Nice-to-have, parked for later (documented so they're not forgotten)
- Hindi UI label toggle; patient-facing report link behind the QR; SMS fallback; multi-user networked setup if a second PC is added; cloud mirror of backups beyond Drive. None are needed for launch.

---

*Source images consolidated at `/Users/namansharma/Downloads/Lab App/_allphotos/` (74 screenshots) + 5 report PDFs in the parent folder. The catalogue in §5 is the cleaned, deduplicated extraction; the raw old-app list contained many duplicate codes and dummy rows that were intentionally dropped.*
