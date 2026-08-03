# Changelog

All notable changes to NamAsta Diagnostics. Newest first.

## v1.3.95

- **Forgot password recovery with activation key.** On the login screen, paste a valid
  activation key to unlock the subscription and set a new admin password. Lab data,
  patients, and CBC/analyzer settings are never wiped. Also detects when an activation
  key is pasted into the password field by mistake.

## v1.3.94

- **Playwright end-to-end testing framework added.** Development dependency for future browser-based QA.
- **Reliable WhatsApp deep-link opening.** Uses `tauri-plugin-opener` (`open_path`) instead of raw
  `Command::spawn()` so the OS has time to register the `whatsapp://` URL handoff. Fixes the race
  condition where WhatsApp Desktop would not open. Applies to both Report and Bill screens.

## v1.3.93

- **WhatsApp now attaches the actual report/bill PDF.** The free "send on WhatsApp" flow opens the
  **WhatsApp Desktop** chat (instead of a browser tab) with the message ready and the real **PDF**
  on the clipboard — press **Ctrl + V** to attach it as a document, then Enter. Previously it copied
  an image and often opened a logged-out web tab, so recipients frequently got only the text. Applies
  to both the report and the bill screens. (Fallback: 📎 → Document → the highlighted file.)

## v1.3.85

- **Structured Stool & Semen reports.** "Stool Examination" and "Semen Analysis" are now full
  multi-parameter panels (like the Urine report) instead of a single free-text box. Ordering one
  opens a complete form with every parameter pre-filled with its normal value — colour, consistency,
  occult blood, cysts/ova, parasites for stool; volume, count, motility, morphology, etc. for semen —
  so you just adjust what differs. The report prints them in grouped sub-sections (Physical /
  Chemical / Microscopic) with a reference column, on screen, PDF, print, WhatsApp and Word.
- **Delete a patient.** The patient list now has a Delete action (with a confirmation prompt) to
  remove a patient registered twice or entered by mistake — it clears that patient's orders, results
  and bill in one step.

## v1.3.84

- **Patient bill / receipt.** A new Bill screen — reachable from the patient list, straight after
  registering a patient ("Save & Bill"), or from the report screen — prints a clean, fully
  lab-branded receipt: your logo, lab name, signature image, the itemised tests with rates, the
  payable amount (with amount in words), payment mode and date. It can be printed, saved as PDF, or
  sent on WhatsApp / email, exactly like a report.
- **"Baby Boy" / "Baby Girl" gender.** Newborns can be registered with a baby gender that prints
  correctly on the report and the bill.
- **Salmonella Typhi profile.** Salmonella Typhi IgG and IgM are now a single orderable profile that
  expands into both result rows on entry — same one-line-bill behaviour as the CBC / HbA1c profiles.
- **Test Master editing improvements.** Reworked test & panel editing — a dedicated panel editor and
  a tabbed test editor — for easier management of tests, profiles and their reference ranges.
- The signature setting is now labelled generically ("Signature") so it reads the same for any lab.

## v1.3.83

- **Updated subscription pricing.** First-year registration is now **₹4,500** (was ₹5,000) and the
  annual renewal is **₹1,800** (was ₹1,000). The activation, renewal and Settings → Subscription
  screens all reflect the new amounts.

## v1.3.82

- **CBC report header now reads "CBC".** The complete-blood-count report previously printed under
  the shared **HAEMATOLOGY** department heading; it now prints under its own **CBC** heading. (Other
  haematology panels — DLC, coagulation — are unchanged.)

## v1.3.81

- **HbA1c is now its own profile.** Searching **HBA1C** surfaces a single "HbA1c (Glycosylated Hb)"
  profile at the top of the list; adding it bills as one line and expands into its two rows on save —
  **HbA1c** and the auto-calculated **eAG** (Estimated Average Glucose = 28.7 × HbA1c − 46.7, filled
  automatically as you enter HbA1c and locked on approval). On the report it prints under its own
  heading **HBA1C/GLYCOSYLATED HB** (and nothing else above it), instead of beneath DIABETIC PROFILE.
- **"Haematology" spelling fixed everywhere.** Any panel or test still showing the American
  *Hematology* or the *Hemotology* typo (in any letter case) is corrected to **Haematology**, so the
  department heading reads consistently. (Also fixed the "e.g. Haemoglobin" hint in the test editor.)
- **Optional combined BIOCHEMISTRY section.** Each biochemistry profile (Diabetic, Renal, Lipid,
  Electrolytes, Liver…) now prints under its **own** heading rather than a shared BIOCHEMISTRY
  umbrella. For labs that prefer a single combined section, the common analytes are also available as
  "…1" duplicate tests that group together under one **BIOCHEMISTRY** heading.
- **One-tap Bilirubin in search.** Typing "BIL" now surfaces a single "Bilirubin — Total + Direct +
  Indirect" row that adds all three at once; each still keeps its own result row, range and price.
- Entering a **negative age** now shows a consistent "Age must be greater than 0" message regardless
  of the unit (days previously showed a different wording).
- **Movable, resizable CBC histograms.** Each WBC / RBC / PLT histogram on a CBC report can be
  clicked to select, dragged to reposition, and resized from its handles (Excel-style). The chosen
  size and position is saved **lab-wide** and re-applied to every CBC report; a "Reset histogram
  positions" button clears them. The adjustments carry through to the PDF/print output.

## v1.3.80

- **LDL Cholesterol now calculates even on a raised lipid profile.** It was being left blank
  whenever triglycerides were above 400 (the Friedewald cut-off), which also blanked the LDL/HDL
  ratio. LDL (= Total − HDL − TG/5) now computes at every triglyceride level — consistent with
  VLDL and Non-HDL, which already did.

## v1.3.79

- The page-resize box now stays **inside the page on the normal report too** (not just edited
  reports). Its bottom is hard-clamped to the footer/signature line, so the resizable square and
  its handles can never be dragged or auto-sized below the A4 sheet — on any report.

## v1.3.78

- The page-resize box on an edited report can no longer be dragged **below the page**. Its bottom
  is now clamped to the footer/signature line, so the resizable square always stays inside the A4
  sheet (it could previously stretch to the content's full height and drop off the page).

## v1.3.77

- Fixed a bug where editing a report and saving it could **stretch the page longer than A4**,
  pushing the signature/footer down or onto a new page. Saved edited reports are now pinned to a
  fixed A4 sheet and the content auto-fits to the page (shrinks to fit, like the normal report) —
  this also repairs reports that were already saved with the stretched layout.

## v1.3.76

- **Page adjustments now persist per test.** When you move a panel between pages (↑/↓) or resize
  its page, that layout is saved against the test (e.g. CBC) and automatically re-applied to every
  future report containing it — set it once, never redo it. Previously these were per-patient and
  reset on the next report. A "Reset saved page layouts" button (Layout panel) clears them.

## v1.3.75

- Fixed the app icon showing blank/old on the Windows `.exe`, desktop shortcut and taskbar. The
  icon file was PNG-encoded at every size, which Windows Explorer/taskbar fail to render; it's now
  rebuilt as a BMP/DIB icon (16–256 px) that displays correctly on Windows 7, 10 and 11.
  (Windows still caches old icons — re-pin or restart if an in-place update keeps the previous one.)

## v1.3.74

- Report name box: the field labels (Name, Age/Gender, Test Request ID…) are now normal weight
  and the **filled-in values are bold** — matching the lab's printed paper.
- Out-of-range results are **auto-bolded** in every panel (both low and high), not just CBC, so
  abnormal values stand out at a glance.
- The lab logo (and other branding) now reliably shows in the digital report even on reports that
  were manually edited — the saved report re-syncs the current logo from Settings → Branding.

## v1.3.70

- Licence downgrade guard: a key that expires earlier than your current, still-valid licence is
  no longer applied — it can't silently shorten your subscription (with a clear message).
- Setup now enforces the password policy when the lab creates its first admin account.

## v1.3.69

- Adopted the supplied **official logo artwork** (microscope + atom orbitals + hexagon, blue/teal)
  as the real image — squared and used pixel-for-pixel for the app icon (Windows `.ico`, macOS
  `.icns`, all PNG sizes), the in-app brand mark (sidebar, login, onboarding) and the browser
  favicon. The logo is now identical everywhere.

## v1.3.68

- New logo recreated to match the supplied reference: a tilted **microscope** inside crossing
  **atom orbitals** and a **hexagon frame**, two-tone blue/teal on a soft tile. Applied across
  the app icon (Windows `.ico`, macOS `.icns`, PNGs), the in-app mark, the favicon and the
  login/onboarding/sidebar logos.

## v1.3.67

- Refined the new logo into a clean, professional **filled microscope** (eyepiece, arm, stage,
  base) with golden specimen drops, on a fresh **cyan → blue → indigo** gradient tile. Replaces
  the rough first draft; stays crisp and clearly a microscope down to 16 px.
- Synced the new art across the app icon (`.ico`/`.icns`/PNG), the in-app mark, the favicon and
  the login/onboarding/sidebar logos.

## v1.3.66

- **New app logo: a microscope + blood-drop** on the maroon tile (microscope = diagnostics,
  blood drop = pathology). Bolder and fuller so it stays clearly visible at small sizes — fixes
  the icon looking tiny/blank on the Windows 7/10 taskbar and on the downloaded `.exe`.
- Regenerated all platform icons (Windows `.ico`, macOS `.icns`, PNGs) and updated the in-app
  brand mark, the browser favicon and the login/onboarding/sidebar logos to match.

## v1.3.65

- Every lab-specific string printed on a report is now editable in **Settings → Lab Identity** —
  nothing is baked in. Added the last two: **Signature Label** (e.g. "Lab Technician" /
  "Pathologist" / "Lab In-charge") and **End-of-report Text**. Together with logo (upload),
  lab name, tagline, address, phones, timings, signatory name + qualification, equipment line and
  the footer lines, the report is fully white-label.
- Genericised all remaining SCL/Sharma example placeholders in the setup & settings forms.

## v1.3.64

- Removed the last hardcoded SCL/Sharma branding from reports. The **"FULLY COMPUTERISED HI-TECH
  LAB." tagline is now a configurable field** (Settings → Lab Identity → Tagline) instead of being
  baked into every report and the Word export — it prints only if the lab enters one. The Lab
  Identity live-preview no longer shows the SCL logo/tagline either. This is a white-label app for
  any lab; nothing SCL-specific should appear unless the lab sets it.

## v1.3.63

- The report letterhead now shows **only the lab's own uploaded logo** (Settings → Branding).
  The hardcoded "SCL" fallback mark has been removed, so a lab that hasn't uploaded a logo no
  longer shows another company's logo on its reports.

## v1.3.62

- Fixed "Edit report" on a report that already has saved edits: the content no longer collapses
  / slides down and disappears. The editor snapshot is now always normalised to natural top-to-
  bottom flow (stripping any baked-in resize transforms), whether it starts from the saved edit
  or the live report.
- Includes v1.3.61: page stretch reaches exactly down to just above the signature (measured live).

## v1.3.61

- Page stretch now reaches **exactly down to just above the signature**. The ceiling is measured
  live from each page's real frame→signature distance (instead of an off-screen estimate that
  stopped short), so the empty space under a short panel can be fully used — no further, no less.

## v1.3.60

- Page resize can now stretch a short panel **all the way down to just above the signature**,
  using the empty space that was previously wasted. (The old 300% limit stopped well short of
  the signature on short reports.) Tall panels still stay clamped so they never bleed off the page.

## v1.3.59

- Name box now **repeats on every page by default**. A new "Hide name box on page #" field lets
  you name a single page number to omit it on (e.g. page 2 for a long test that continues there).
- Fixed long panels bleeding past the page edge: pages auto-fit with a safety margin and the
  manual page-resize handles can no longer stretch content off the page.
- Smoother editor: drag-selection only recomputes when you cross into a new cell, and column
  resize is frame-throttled.

## v1.3.58

- **Spreadsheet-grade report editor.** "Edit report" now behaves like a real spreadsheet for the
  test tables: click a cell to select it, double-click / F2 / start typing to edit, arrow keys to
  move, Tab/Enter to move on (Excel-style). Drag or Shift+arrows select a block, a column heading
  selects the whole column, Ctrl/⌘+A selects all. Ctrl/⌘+C / X / V copy, cut and paste cell blocks
  (a single copied cell fills a whole selection). Delete clears, Esc deselects.
- Table structure editing: right-click (or the toolbar) to insert / delete rows & columns, clear
  contents, and toggle cell borders. Drag a column heading's right edge to resize. Vertical
  alignment (top / middle / bottom) for selected cells.
- Selection, gridlines and highlights are on-screen only — the printed report, PDF and WhatsApp
  copy stay clean with no grid.
- **Continuation pages.** The patient name box now prints only on the first page; pages 2+ are
  clean continuation pages (letterhead, footer and signature stay, name box omitted) — ideal when
  a long single test runs onto the next page. A "Repeat name box on every page" toggle restores
  the old behaviour.
- Urine report is grouped under PHYSICAL / CHEMICAL / MICROSCOPIC EXAMINATION headings.
- Report preview and the configuration sidebar now scroll independently.

## v1.1.9

- CBC report: abnormal values now bold the **test name** too, not just the result — matching
  the H360's own printout where the full row stands out for out-of-range results.
- PLT histogram x-axis corrected to 0 / 10 / 20 / 30 fL (was 0 / 10 / 20 / 35).

## v1.1.8

- Reports now show all panels together on one page by default — exactly like the old system.
  Tests from different departments (HAEMATOLOGY, BIOCHEMISTRY, etc.) appear in sequence with
  department headings, and a bold underlined panel sub-heading separates panels within the
  same department. A "All panels on one page" toggle in Layout switches back to the old
  one-panel-per-page format.
- CBC histograms are now vertically aligned beside their sections: WBC Histogram sits next to
  LEUKOCYTES, RBC Histogram next to ERYTHROCYTES, PLT Histogram next to THROMBOCYTES —
  matching the H360's own printout. All three histograms now show reference dashed lines.
- Units column widened (was 10%, now 12%) and marked no-wrap — fixes "10^3/µL" breaking
  across two lines on the CBC report.
- PDFs of compact (tall) reports are now correctly paginated: the content is rendered at its
  full height and sliced into A4 pages rather than being clipped at 297mm.

## v1.1.7

- CBC report now shows WBC / RBC / PLT histogram charts to the right of the test table,
  matching the layout of the H360/DH3x own printout. Charts are generated from the patient's
  own differential % (WBC), MCV + RDW-SD (RBC), and MPV + PDW-SD (PLT), so the curve
  shape reflects the actual patient result. Real captured histogram data is used when
  available; synthetic curves are the fallback.

## v1.1.6

- Alkaline Phosphatase (ALP) reference ranges corrected to the lab's validated values:
  0–15 years 210–810 U/L, adults (15+) 100–306 U/L.
  (Previous entries used generic textbook ranges that did not match the lab's practice.)

## v1.1.5

- CBC report now matches the H360's own printed layout: results are grouped under
  LEUKOCYTES / ERYTHROCYTES / THROMBOCYTES section headers with a divider line, and
  out-of-range values are printed in bold (no ↑H / ↓L text — just bold), exactly as the
  machine's own printout shows.

## v1.1.4

- Reports no longer print High / Low (↑H ↓L) flags or abnormal-value bolding — the result
  column is clean. (Flags are still computed and stored internally; they just aren't shown.)
- Widal is now reported in full: the four agglutinin-titre lines (S. Typhi "O" & "H",
  S. Paratyphi "AH" & "BH", each selectable 1:20 → 1:640) plus separate Widal IgG / IgM lines.
  The existing "Widal Test" / "Widal Test (Tube Method)" stay as the billable items.

## v1.1.3

- Settings → Analyzer → Capture raw: added a "Copy all" button on the raw-output box (and the
  text is now one-click select-all), so the machine's raw transmission can be copied easily for
  support / format checks.

## v1.1.2

- Analyzer capture no longer cuts off early. The cell counter sends the numeric results, then
  pauses while it renders the histogram, then sends it — the old 2-second idle timeout ended the
  capture in that gap (losing the graphs and the last few values). It now waits up to 12 seconds
  of silence (and stops instantly when the machine closes the connection), so the full
  transmission — including the histogram — comes through.

## v1.1.1

- CBC analyzer now reads the Dymind DH3x (and other HL7 v2 cell counters). Previously the app
  only understood ASTM "R|" records, so it received the data but matched zero parameters
  ("Data received, but no parameters matched"). It now parses HL7 OBX result lines (WBC, HGB,
  RBC, PLT, LYM%/GRAN%/MID% and the rest), which map straight onto the lab's CBC test codes.

## v1.1.0

- Editable reports: an "Edit report" button on the report preview makes it editable like a
  document — change/add/delete any text, then Save. The edited version is stored and is what
  prints, WhatsApps and emails. "Revert to original" restores the auto-generated report.
- Approve with blanks: you no longer have to fill every ordered test. Approve any time; tests
  left blank are simply omitted from the printed report (they don't show as empty rows).

## v1.0.9

- "Read from analyzer": when the H360 sends data that doesn't match the patient's ordered tests,
  the app now shows the exact raw text the machine sent in a dialog with a "Copy raw text" button,
  instead of a dead-end error. Makes it easy to capture an analyzer's format for support without
  the timed Settings → Analyzer capture.

## v1.0.8

- Reports now print only the tests that have a value — blank / un-entered rows (and any panel
  whose tests are all blank) are left off the printed report.
- Report table columns balanced: Test Name and Normal Ranges are equal width, closing the wide
  gap between Test Name and Results.
- Result-entry fields accept text as well as numbers (Trace, <5, "1.2 (repeat)", etc.).
- Added Typhidot as two lines — Salmonella Typhi IgG and IgM (Reactive / Non-Reactive) — with
  the standard interpretation note.

## v1.0.7

- Analyzer setup: "This PC's IP" now lists every network address the PC has (e.g. the Wi-Fi
  card AND the wired card connected to the analyzer), instead of guessing one — so you can
  pick the address on the analyzer's network. The old guess showed the internet card, which
  on a dual-network lab PC is the wrong one for the H360.

## v1.0.6

- Fix the app freezing ("not responding") during "Read from analyzer", and during email /
  WhatsApp / SMS sends and backups. Those native operations ran on the UI thread and blocked
  it for the whole network/serial window; they now run on a background thread.
- Result-entry fields accept text as well as numbers (e.g. "Trace", "<5", "1.2 (repeat)").
  Numeric tests still get a number keypad and H/L flags read the numeric part.
- Report table: Test Name and Normal Ranges columns are now equal width with a fixed layout,
  tightening the gap between Test Name and Results.

## v1.0.5

- Enable Ctrl +/− (and Ctrl+0) zoom on Windows — the webview zoom hotkeys were off by default,
  so zooming out to fit a small screen did nothing.
- Fuller app icon so it stays crisp and legible at small Windows taskbar sizes (the previous
  macOS-style icon had large transparent margins that made the mark tiny on Windows).

## v1.0.4

- Actually fix scrolling on small / 1366×768 / display-scaled screens. `body` had
  `overflow:hidden`, so any page taller than the screen (the onboarding "Set up your lab"
  form, login) was clipped with no way to scroll to the fields/buttons at the bottom. The
  window now scrolls vertically when a page is taller than the viewport; the app shell still
  scrolls inside itself. (v1.0.3 only resized the window — the content still couldn't scroll.)

## v1.0.3

- Fix the window not fitting / not scrolling on smaller or display-scaled laptops (e.g.
  1366×768 or 125–150% scaling): the window now opens maximized and allows a much smaller
  minimum size, so its bottom edge can't fall off-screen. Also made the login screen scroll
  on short windows instead of clipping its content.

## v1.0.2

- App icon: transparent corners restored (v1.0.1 rendered the squircle on an opaque white
  square because the rasterizer flattened transparency). Icons now build straight from the
  SVG via Tauri/resvg, so the corners are properly transparent — like every other macOS app.

## v1.0.1

- Fix the app icon: a proper macOS-style rounded "squircle" with the NamAsta blood-tube mark
  centred and correct margins (the v1.0.0 icon rendered as a tiny mark in a blank square).

## v1.0.0 — first public release

- Production release: signed Windows installer + automatic in-app updates over GitHub Releases.
- Offline-first lab management: patient registration, result entry with age/sex reference
  ranges, approval-locked reports, and WhatsApp / email / SMS / print delivery.
- Device-locked offline activation keys (up to 2 PCs per key); ₹5,000 first year, ₹1,000 renewal.
- Daily dual backups, audit trail, role-based access (admin / technician).
- Keyboard-first entry (↑/↓ to move between fields) and per-age-group units on reports.
