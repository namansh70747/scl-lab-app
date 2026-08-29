import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { getPatientById, getBill } from "@/lib/queries/patients";
import { getOrdersWithResults, getReportComment, approvePatient, getReportOverride, saveReportOverride, clearReportOverride } from "@/lib/queries/results";
import { listPanels } from "@/lib/queries/tests";
import { getAllSettings } from "@/lib/queries/settings";
import { logDelivery, hasDelivered } from "@/lib/queries/delivery";
import { computeCalculated, resolveCalculated, safeDecimals } from "@/lib/calc";
import { computeFlag, patientAgeDays, findRange, displayRange, rangesWithOverride } from "@/lib/flags";
import { generateReportQR } from "@/lib/qr";
import { revealInFolder } from "@/lib/printing";
import { saveReportPdf, printReportPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";
import { buildWhatsAppMessage, sendWhatsAppSemi } from "@/lib/whatsapp";
import { formatDate, genderLabel } from "@/lib/format";
import { getHistograms } from "@/lib/queries/analyzer";
import { CbcSectionHistogram } from "@/components/report/Histogram";
import { OrderWithResult, Panel } from "@/types";
import { ChevronLeft, Printer, FileDown, MessageCircle, Mail, Check, ZoomIn, ZoomOut, Smartphone, Receipt, ShieldCheck, Loader2, Pencil, Save, X, RotateCcw, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, IndentIncrease, IndentDecrease, Undo, Redo, RemoveFormatting, Baseline, Highlighter, ArrowUp, ArrowDown, FileType2, Rows3, Columns3, Eraser, Square, Copy, ClipboardPaste, Scissors, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd } from "lucide-react";
import { exportReportDocx, type ReportDocxModel, type DocxPanel, type DocxRow, type DocxSubSection } from "@/lib/docx";
import { rasterizeHistograms } from "@/lib/docxHistograms";
import { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const NORMAL_QUALITATIVE = new Set(['NEGATIVE', 'NIL', 'NOT SEEN', 'ABSENT', 'NORMAL', 'CLEAR', 'PALE YELLOW']);

/** Escape user text before putting it into the email HTML body (patient name etc.). */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  ));
}

/**
 * Which discipline each panel prints under. On the printed report the discipline
 * (e.g. HAEMATOLOGY) is a single centred heading, and the individual profiles within
 * it appear as left-aligned underlined sub-headings. Unmapped panels stand alone — their
 * own report_heading IS the centred heading (deptOf falls back to it).
 *
 * The biochemistry profiles (Diabetic / Renal / Lipid / Electrolytes / Liver / Thyroid /
 * Hormones) are intentionally NOT mapped here, so each prints under its own profile name
 * (e.g. DIABETIC PROFILE) rather than a shared BIOCHEMISTRY umbrella. The BIOCHEMISTRY
 * heading is reserved for the BIO panel — the misc biochemistry tests plus the "…1"
 * duplicate tests the lab orders when it wants a single combined BIOCHEMISTRY section.
 */
const DEPARTMENT: Record<string, string> = {
  HEM: 'HAEMATOLOGY', CBC: 'CBC', DLCP: 'HAEMATOLOGY', COAG: 'HAEMATOLOGY', PTI: 'HAEMATOLOGY',
  BIO: 'BIOCHEMISTRY', BILI2: 'BIOCHEMISTRY',
  // The standalone bilirubin combo prints under the LFT heading — the string must match the LFT
  // panel's own report_heading so an order carrying both merges under one department title.
  BILI1: 'LIVER FUNCTION TEST (LFT)',
  SERO: 'SEROLOGY', SALP: 'SEROLOGY', WIDALP: 'SEROLOGY', DENGP: 'SEROLOGY',
  URINE: 'CLINICAL PATHOLOGY', STOOL: 'CLINICAL PATHOLOGY', SEMEN: 'CLINICAL PATHOLOGY', FLUID: 'CLINICAL PATHOLOGY',
  MICRO: 'MICROBIOLOGY',
  MISC: 'MISCELLANEOUS',
};
const deptOf = (p: Panel): string => DEPARTMENT[p.code] ?? p.report_heading;
// A panel sub-heading that merely repeats the department (even with a spelling variant like
// HAEMATOLOGY↔HEMATOLOGY) must NOT print twice. Normalise before comparing.
const normHeading = (s: string): string => (s || '').toUpperCase().replace(/HAEM/g, 'HEM').replace(/[^A-Z0-9]/g, '');
const sameHeading = (a: string, b: string): boolean => normHeading(a) === normHeading(b);

/** Urine test-code → section header. */
const URINE_SECTION: Record<string, string> = {
  U_QTY:     'PHYSICAL EXAMINATION',
  U_COLOUR:  'PHYSICAL EXAMINATION',
  U_APP:     'PHYSICAL EXAMINATION',
  U_REACT:   'PHYSICAL EXAMINATION',
  U_SG:      'PHYSICAL EXAMINATION',
  U_PROTEIN: 'CHEMICAL EXAMINATION',
  U_GLUCOSE: 'CHEMICAL EXAMINATION',
  U_KETONE:  'CHEMICAL EXAMINATION',
  U_BLOOD:   'CHEMICAL EXAMINATION',
  U_BILE_S:  'CHEMICAL EXAMINATION',
  U_BILE_P:  'CHEMICAL EXAMINATION',
  U_URO:     'CHEMICAL EXAMINATION',
  U_NITRITE: 'CHEMICAL EXAMINATION',
  U_PUS:     'MICROSCOPIC EXAMINATION',
  U_RBC:     'MICROSCOPIC EXAMINATION',
  U_EPIT:    'MICROSCOPIC EXAMINATION',
  U_CAST:    'MICROSCOPIC EXAMINATION',
  U_CRYSTAL: 'MICROSCOPIC EXAMINATION',
  U_BACTERIA:'MICROSCOPIC EXAMINATION',
};

/** Stool test-code → section header. */
const STOOL_SECTION: Record<string, string> = {
  STOOL_COLOUR:       'PHYSICAL EXAMINATION',
  STOOL_CONSIST:      'PHYSICAL EXAMINATION',
  STOOL_MUCUS:        'PHYSICAL EXAMINATION',
  STOOL_BLOOD:        'PHYSICAL EXAMINATION',
  STOOL_WORMS:        'PHYSICAL EXAMINATION',
  STOOL_PH:           'PHYSICAL EXAMINATION',
  STOOL_OCCULT:       'CHEMICAL EXAMINATION',
  STOOL_REDUCING:     'CHEMICAL EXAMINATION',
  STOOL_CYST:         'MICROSCOPIC EXAMINATION',
  STOOL_OVA:          'MICROSCOPIC EXAMINATION',
  STOOL_PUS:          'MICROSCOPIC EXAMINATION',
  STOOL_FLAGELLATES:  'MICROSCOPIC EXAMINATION',
  STOOL_TROPHOZOITES: 'MICROSCOPIC EXAMINATION',
  STOOL_RBC:          'MICROSCOPIC EXAMINATION',
  STOOL_ECOLI:        'MICROSCOPIC EXAMINATION',
  STOOL_EHISTO:       'MICROSCOPIC EXAMINATION',
  STOOL_GIARDIA:      'MICROSCOPIC EXAMINATION',
  STOOL_HOOKWORM:     'MICROSCOPIC EXAMINATION',
  STOOL_HNANA:        'MICROSCOPIC EXAMINATION',
  STOOL_ASCARIS:      'MICROSCOPIC EXAMINATION',
};

/** Semen test-code → section header. */
const SEMEN_SECTION: Record<string, string> = {
  SEM_VOLUME:    'PHYSICAL EXAMINATION',
  SEM_COLOUR:    'PHYSICAL EXAMINATION',
  SEM_LIQTIME:   'PHYSICAL EXAMINATION',
  SEM_COUNT:     'SPERM COUNT & MOTILITY',
  SEM_MOTILITY:  'SPERM COUNT & MOTILITY',
  SEM_HIGHMOTILE:'SPERM COUNT & MOTILITY',
  SEM_SLUGGISH:  'SPERM COUNT & MOTILITY',
  SEM_DEAD:      'SPERM COUNT & MOTILITY',
  SEM_NORMAL:    'MORPHOLOGY',
  SEM_ABNORMAL:  'MORPHOLOGY',
  SEM_TAIL:      'MORPHOLOGY',
  SEM_NECK:      'MORPHOLOGY',
  SEM_HEADLESS:  'MORPHOLOGY',
  SEM_PUS:       'MICROSCOPIC EXAMINATION',
  SEM_RBC:       'MICROSCOPIC EXAMINATION',
  SEM_EPITH:     'MICROSCOPIC EXAMINATION',
};

/** CBC test-code → section header (LEUKOCYTES / ERYTHROCYTES / THROMBOCYTES). */
const CBC_SECTION: Record<string, string> = {
  WBC: 'LEUKOCYTES', LYM_PCT: 'LEUKOCYTES', MID_PCT: 'LEUKOCYTES', GRAN_PCT: 'LEUKOCYTES',
  LYM_NUM: 'LEUKOCYTES', MID_NUM: 'LEUKOCYTES', GRAN_NUM: 'LEUKOCYTES',
  RBC_CNT: 'ERYTHROCYTES', HGB: 'ERYTHROCYTES', HCT: 'ERYTHROCYTES', MCV: 'ERYTHROCYTES',
  MCH: 'ERYTHROCYTES', MCHC: 'ERYTHROCYTES', RDW_SD: 'ERYTHROCYTES', RDW_CV: 'ERYTHROCYTES',
  PLT_CBC: 'THROMBOCYTES', MPV: 'THROMBOCYTES', PCT_CBC: 'THROMBOCYTES',
  PDW_SD: 'THROMBOCYTES', PDW_CV: 'THROMBOCYTES', PLCR: 'THROMBOCYTES', PLCC: 'THROMBOCYTES',
};

// Bump this to force every layout setting back to the known-good defaults (clears any
// accumulated experimental/buggy values from older builds).
const LAYOUT_VERSION = '7';
const layoutFresh = (): boolean => localStorage.getItem('scl_layout_v') === LAYOUT_VERSION;
// Pre-printed paper signature defaults (all user-adjustable & persisted): distance from the page
// bottom, image height, and distance from the right margin (shifts it left).
const SIG_BOTTOM_MM = 35;
const SIG_HEIGHT_MM = 24;
const SIG_RIGHT_MM = 25;

// Per-column minimum width (%). Test Name holds long names ("eGFR (CKD-EPI)") so it needs room —
// below ~18% it collapses to one letter per line. The numeric columns can go narrower.
const COL_MIN = [18, 8, 8, 12];
const COL_DEFAULT = [24, 18, 12, 46];
// Reject a saved layout that would render broken (any column under its minimum) → use the default.
const colWidthsValid = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === 4 && v.every((w, i) => typeof w === 'number' && w >= COL_MIN[i]);

// ── Movable / resizable CBC histograms ──────────────────────────────────────────────────────
// Each WBC/RBC/PLT histogram behaves like an Excel object: click to select, drag the body to move
// it freely, drag the 8 handles to resize. The chosen size+position is saved LAB-WIDE per
// histogram (scl_histo_layout) and applied as a CSS transform so it survives html2canvas/PDF
// capture; the selection chrome is data-report-control + print:hidden so pdf.ts strips it.
type HistoKey = 'WBC' | 'RBC' | 'PLT';
type HistoEntry = { dx?: number; dy?: number; sx?: number; sy?: number };
type HistoLayout = Record<string, HistoEntry>;
const SECTION_TO_HISTO: Record<string, HistoKey> = { LEUKOCYTES: 'WBC', ERYTHROCYTES: 'RBC', THROMBOCYTES: 'PLT' };

// Total multiplicative screen-vs-layout factor from every ancestor zoom/scale(): getBoundingClientRect
// is post-transform, offset{Width,Height} are untransformed CSS px, so the ratio folds in the viewer
// zoom, the per-panel section scale() and the contentScale zoom at once — no transform-string parsing.
// Used to convert a screen-pixel drag delta into the histogram's local (layout) pixels.
function ancestorFactorXY(el: HTMLElement): { fx: number; fy: number } {
  const r = el.getBoundingClientRect();
  return { fx: (el.offsetWidth ? r.width / el.offsetWidth : 1) || 1, fy: (el.offsetHeight ? r.height / el.offsetHeight : 1) || 1 };
}

// Keep the histogram's rendered box inside the page's content body and above the footer line.
// Computed in screen space from live element rects, then the correction is converted back to the
// anchor's local px via fx/fy — correct under any zoom/section-scale/contentScale combination.
function clampHistoTranslate(anchor: HTMLElement | null, dx: number, dy: number, sx: number, sy: number): { dx: number; dy: number } {
  if (!anchor) return { dx, dy };
  const page = anchor.closest('[data-report-page]') as HTMLElement | null;
  if (!page) return { dx, dy };
  const a = anchor.getBoundingClientRect();
  const fx = anchor.offsetWidth ? a.width / anchor.offsetWidth : 1;
  const fy = anchor.offsetHeight ? a.height / anchor.offsetHeight : 1;
  const body = ((page.querySelector('.report-body') as HTMLElement | null) ?? page).getBoundingClientRect();
  const foot = page.querySelector('.report-letterfoot') as HTMLElement | null;
  const minLeft = body.left, maxRight = body.right, minTop = body.top;
  const maxBottom = foot ? foot.getBoundingClientRect().top : body.bottom;
  const boxW = a.width * sx, boxH = a.height * sy;
  let cdx = dx, cdy = dy;
  // Clamp bottom/right first, then top/left wins — keeps the top-left corner on the sheet when the
  // box is larger than the available area (better than pinning the bottom-right off-screen).
  if (a.left + cdx * fx + boxW > maxRight) cdx -= (a.left + cdx * fx + boxW - maxRight) / (fx || 1);
  if (a.left + cdx * fx < minLeft) cdx += (minLeft - (a.left + cdx * fx)) / (fx || 1);
  if (a.top + cdy * fy + boxH > maxBottom) cdy -= (a.top + cdy * fy + boxH - maxBottom) / (fy || 1);
  if (a.top + cdy * fy < minTop) cdy += (minTop - (a.top + cdy * fy)) / (fy || 1);
  return { dx: +cdx.toFixed(1), dy: +cdy.toFixed(1) };
}

const HISTO_HANDLES: { dir: string; pos: React.CSSProperties }[] = [
  { dir: 'nw', pos: { top: -5, left: -5, cursor: 'nwse-resize' } },
  { dir: 'n',  pos: { top: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
  { dir: 'ne', pos: { top: -5, right: -5, cursor: 'nesw-resize' } },
  { dir: 'e',  pos: { top: '50%', right: -5, marginTop: -5, cursor: 'ew-resize' } },
  { dir: 'se', pos: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
  { dir: 's',  pos: { bottom: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
  { dir: 'sw', pos: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
  { dir: 'w',  pos: { top: '50%', left: -5, marginTop: -5, cursor: 'ew-resize' } },
];

/** Wraps one CBC histogram so it can be selected, moved and resized like an Excel object. The
 *  ANCHOR (un-transformed) preserves the table slot; the MOVABLE child carries the translate+scale;
 *  the CHROME overlay (handles + reset) sits on the scaled box and is stripped from PDF/print. */
function MovableHistogram({ histoKey, entry, selected, editing, onSelect, onChange, onReset, children }: {
  histoKey: HistoKey;
  entry: HistoEntry | undefined;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onChange: (dx: number, dy: number, sx: number, sy: number) => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const dx = entry?.dx ?? 0, dy = entry?.dy ?? 0, sx = entry?.sx ?? 1, sy = entry?.sy ?? 1;
  const moved = !!entry && (entry.dx != null || entry.dy != null || entry.sx != null || entry.sy != null);

  // Measure the natural (un-transformed) box so the chrome overlay tracks the scaled histogram.
  useLayoutEffect(() => {
    const a = anchorRef.current; if (!a) return;
    const measure = () => setNat({ w: a.offsetWidth, h: a.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(a);
    return () => ro.disconnect();
  }, []);

  // Latest values for the keyboard-nudge listener (so it never re-attaches mid-session).
  const latest = useRef({ dx, dy, sx, sy });
  latest.current = { dx, dy, sx, sy };

  useEffect(() => {
    if (!selected || editing) return;
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      const step = e.shiftKey ? 10 : 1;
      const { dx: cx, dy: cy, sx: csx, sy: csy } = latest.current;
      let nx = cx, ny = cy;
      if (e.key === 'ArrowLeft') nx -= step;
      else if (e.key === 'ArrowRight') nx += step;
      else if (e.key === 'ArrowUp') ny -= step;
      else if (e.key === 'ArrowDown') ny += step;
      else return;
      e.preventDefault();
      const c = clampHistoTranslate(anchorRef.current, nx, ny, csx, csy);
      onChange(c.dx, c.dy, csx, csy);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, editing, onChange]);

  const startMove = (e: React.MouseEvent) => {
    if (editing) return;
    e.stopPropagation();
    onSelect();
    const start = { x: e.clientX, y: e.clientY, dx, dy, sx, sy };
    const fxy = ancestorFactorXY(anchorRef.current!);
    const onMove = (ev: MouseEvent) => {
      const ndx = start.dx + (ev.clientX - start.x) / fxy.fx;
      const ndy = start.dy + (ev.clientY - start.y) / fxy.fy;
      const c = clampHistoTranslate(anchorRef.current, ndx, ndy, start.sx, start.sy);
      onChange(c.dx, c.dy, start.sx, start.sy);
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startResize = (e: React.MouseEvent, dir: string) => {
    if (editing) return;
    e.preventDefault(); e.stopPropagation();
    onSelect();
    const a = anchorRef.current!;
    const start = { x: e.clientX, y: e.clientY, dx, dy, sx, sy };
    const fxy = ancestorFactorXY(a);
    const natW = a.offsetWidth || 1, natH = a.offsetHeight || 1;
    const onMove = (ev: MouseEvent) => {
      const ldx = (ev.clientX - start.x) / fxy.fx;
      const ldy = (ev.clientY - start.y) / fxy.fy;
      let nsx = start.sx, nsy = start.sy, ndx = start.dx, ndy = start.dy;
      if (dir.includes('e')) nsx = start.sx + ldx / natW;
      if (dir.includes('w')) { nsx = start.sx - ldx / natW; ndx = start.dx + ldx; }  // pin the right edge
      if (dir.includes('s')) nsy = start.sy + ldy / natH;
      if (dir.includes('n')) { nsy = start.sy - ldy / natH; ndy = start.dy + ldy; }  // pin the bottom edge
      nsx = Math.min(3, Math.max(0.3, nsx));
      nsy = Math.min(3, Math.max(0.3, nsy));
      const c = clampHistoTranslate(anchorRef.current, ndx, ndy, nsx, nsy);
      onChange(c.dx, c.dy, +nsx.toFixed(3), +nsy.toFixed(3));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={anchorRef} data-histo-anchor={histoKey} style={{ position: 'relative' }}>
      <div
        onMouseDown={editing ? undefined : startMove}
        className={cn(!editing && !selected && "hover:outline hover:outline-1 hover:outline-dashed hover:outline-[#a5b4fc]")}
        style={{
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: 'top left',
          cursor: editing ? undefined : (selected ? 'move' : 'pointer'),
        }}
      >
        {children}
      </div>

      {!editing && selected && nat.w > 0 && (
        <div data-report-control contentEditable={false} className="absolute print:hidden"
          style={{ left: dx, top: dy, width: nat.w * sx, height: nat.h * sy, zIndex: 14, pointerEvents: 'none' }}>
          <div className="absolute inset-0 border border-[#6366f1] rounded-[2px]" />
          {HISTO_HANDLES.map(h => (
            <div key={h.dir} onMouseDown={e => startResize(e, h.dir)} className="absolute"
              style={{ width: 10, height: 10, background: '#6366f1', border: '1.5px solid #fff', borderRadius: 2, boxShadow: '0 0 0 1px #6366f1', pointerEvents: 'auto', ...h.pos }} />
          ))}
          <div className="absolute -top-5 left-0 flex items-center gap-1" style={{ pointerEvents: 'auto' }}>
            <span className="text-[9px] tabular-nums px-1 rounded bg-[#6366f1] text-white leading-tight">{histoKey} · {Math.round(sx * 100)}×{Math.round(sy * 100)}%</span>
            {moved && (
              <button type="button" onMouseDown={e => e.stopPropagation()} onClick={onReset} title="Reset this histogram to default position & size"
                className="text-[9px] px-1 rounded bg-white border border-[#c7c9ff] text-[#6366f1] leading-tight hover:bg-[#eef0fe]">reset</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportPreviewPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const pid = parseInt(patientId ?? '0');
  // Once per build version: discard old layout settings so the clean default layout shows, and
  // reset the pre-printed-paper gaps to the locked 50mm top / 25mm bottom standard.
  useEffect(() => {
    if (localStorage.getItem('scl_layout_v') !== LAYOUT_VERSION) {
      localStorage.setItem('scl_pre_top', '60');      // header gap (measured ~6cm)
      localStorage.setItem('scl_pre_bottom', '22');   // pre-printed footer strip (~2.2cm)
      localStorage.setItem('scl_sig_bottom', '35');   // signature 35mm above the page bottom
      localStorage.setItem('scl_sig_height', '24');   // signature height
      localStorage.setItem('scl_sig_right', '25');    // signature shifted left from the right margin
      localStorage.setItem('scl_layout_v', LAYOUT_VERSION);
    }
  }, []);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sessionUser = useSession(s => s.user);
  const [approving, setApproving] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(() => { const v = Number(localStorage.getItem('scl_zoom')); return v >= 40 && v <= 200 ? v : 100; });
  useEffect(() => { localStorage.setItem('scl_zoom', String(zoom)); }, [zoom]);
  const [showWatermark, setShowWatermark] = useState(() => localStorage.getItem('scl_watermark') === '1');
  const [busy, setBusy] = useState<string | null>(null);
  // In-app report editing: when `editing`, only the [data-editable-body] regions become
  // editable (chrome stays locked). Saving stores the edited HTML so the report screen
  // (and every print/send) shows the edited version until "Revert to original".
  const [editing, setEditing] = useState(false);
  // While editing we edit a STATIC HTML snapshot (not the live React tree), set up
  // IMPERATIVELY via this ref — React must never manage the editable DOM (contentEditable +
  // dangerouslySetInnerHTML together is broken in WebViews; even Ctrl+A fails).
  const [editHtml, setEditHtml] = useState<string | null>(null);
  const editHostRef = useRef<HTMLDivElement>(null);
  // Pre-printed letterhead paper: when OFF, the physical print drops the header/footer
  // and shifts the body down so the data lands inside the paper's printed frame. Digital
  // copies (PDF, WhatsApp, email) always include the full letterhead.
  // Default OFF — the lab prints on pre-printed letterhead paper, so the digital header is
  // hidden and the body is positioned to land inside the paper's frame. Toggle ON for plain paper.
  const [printLetterhead, setPrintLetterhead] = useState(() => localStorage.getItem('scl_print_letterhead') === '1');
  // Robust numeric read: a missing OR empty/garbage stored value falls back to the default
  // (plain Number('') would silently become 0 and break the layout).
  const numLS = (key: string, def: number) => { const n = parseFloat(localStorage.getItem(key) ?? ''); return Number.isFinite(n) ? n : def; };
  // Pre-printed-paper gaps. Standard: 60mm top (lab header) / 22mm bottom (lab footer strip).
  const [preTop, setPreTop] = useState(() => layoutFresh() ? numLS('scl_pre_top', 60) : 60);
  const [preBottom, setPreBottom] = useState(() => layoutFresh() ? numLS('scl_pre_bottom', 22) : 22);
  // Signature: shown via a toggle, with adjustable height, distance-from-bottom and distance-from-
  // right (move left/right) — all persisted so the lab places it exactly over its pre-printed line.
  const [showSignature, setShowSignature] = useState(() => localStorage.getItem('scl_show_signature') !== '0');
  const [sigHeightMm, setSigHeightMm] = useState(() => numLS('scl_sig_height', SIG_HEIGHT_MM));
  const [sigBottomMm, setSigBottomMm] = useState(() => numLS('scl_sig_bottom', SIG_BOTTOM_MM));
  const [sigRightMm, setSigRightMm] = useState(() => numLS('scl_sig_right', SIG_RIGHT_MM));
  // Remark/interpretation boxes the user has deleted for THIS report (by order id) — persisted per
  // patient, and skipped everywhere (preview, PDF, Word). A "restore" link brings them back.
  const [hiddenNotes, setHiddenNotes] = useState<Set<number>>(() => {
    try { const v = JSON.parse(localStorage.getItem(`scl_hidden_notes_${pid}`) || '[]'); return new Set<number>(Array.isArray(v) ? v : []); } catch { return new Set<number>(); }
  });
  const hideNote = (orderId: number) => setHiddenNotes(prev => {
    const next = new Set(prev); next.add(orderId);
    localStorage.setItem(`scl_hidden_notes_${pid}`, JSON.stringify([...next]));
    return next;
  });
  const restoreNotes = () => { setHiddenNotes(new Set()); localStorage.removeItem(`scl_hidden_notes_${pid}`); };
  // Blank space reserved at the bottom of every compact page (mm). The user wants a gap
  // below the data so it never runs to the very edge.
  const [bottomGapMm, setBottomGapMm] = useState(() => { const v = Number(localStorage.getItem('scl_bottom_gap')); return (layoutFresh() && v >= 0 && v <= 60) ? v : 12; });
  // Compact = pack panels across A4 pages (no panel split). Per-page = one A4 per panel.
  const [compactReport, setCompactReport] = useState(() => localStorage.getItem('scl_compact_report') !== '0');
  // Name box (patient strip) repeats on every page by DEFAULT. Turn it off to show the name box
  // on the first page only. Separately, `nameBoxSkipPage` (0 = none) lets the user name ONE page
  // number whose name box should be omitted — e.g. when a long single test continues there.
  const [repeatNameBox, setRepeatNameBox] = useState(() => localStorage.getItem('scl_repeat_namebox') !== '0');
  const [nameBoxSkipPage, setNameBoxSkipPage] = useState(() => Number(localStorage.getItem('scl_namebox_skip') ?? 0));
  // Manual page placement: per-panel overrides on the auto-pagination. 'pull' = drag this
  // panel UP onto the previous page; 'before' = push it DOWN to start a fresh page.
  // Page-layout adjustments PERSIST PER TEST/PANEL, lab-wide. When the lab moves a panel between
  // pages (↑/↓) or resizes its page, the adjustment is saved against the panel CODE (e.g. 'CBC')
  // and re-applied to EVERY future report that contains that panel — until changed again. So the
  // father adjusts a test's page once and never has to redo it. (Old per-patient `scl_breaks_*` /
  // `scl_pagescale_*` keys are simply ignored now.)
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(() => {
    try { const v = JSON.parse(localStorage.getItem('scl_panel_layout') || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  });
  // Mutate one panel's entry via a functional update (robust against the rapid-fire writes a
  // resize drag produces — never reads a stale closure), persisting and dropping empty entries.
  const writePanelEntry = (code: string, mut: (e: { brk?: 'pull' | 'before'; sx?: number; sy?: number }) => void) => {
    setPanelLayout(prev => {
      const e = { ...prev[code] };
      mut(e);
      const next = { ...prev };
      if (e.brk == null && e.sx == null && e.sy == null) delete next[code];
      else next[code] = e;
      if (Object.keys(next).length) localStorage.setItem('scl_panel_layout', JSON.stringify(next));
      else localStorage.removeItem('scl_panel_layout');
      return next;
    });
  };
  const movePanel = (code: string, dir: 'up' | 'down') => writePanelEntry(code, e => {
    e.brk = dir === 'up' ? (e.brk === 'pull' ? undefined : 'pull') : (e.brk === 'before' ? undefined : 'before');
  });
  const setPanelScale = (code: string, sx: number, sy: number) => writePanelEntry(code, e => { e.sx = sx; e.sy = sy; });
  const resetPanelScale = (code: string) => writePanelEntry(code, e => { delete e.sx; delete e.sy; });
  // Per-histogram move/resize (WBC/RBC/PLT), saved LAB-WIDE in scl_histo_layout — set the size &
  // position once and it applies to every future patient's CBC report (mirrors panelLayout).
  const [histoLayout, setHistoLayout] = useState<HistoLayout>(() => {
    try { const v = JSON.parse(localStorage.getItem('scl_histo_layout') || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  });
  const [selectedHisto, setSelectedHisto] = useState<HistoKey | null>(null);
  const writeHistoEntry = (key: string, mut: (e: HistoEntry) => void) => {
    setHistoLayout(prev => {
      const e = { ...prev[key] };
      mut(e);
      const next = { ...prev };
      if (e.dx == null && e.dy == null && e.sx == null && e.sy == null) delete next[key];
      else next[key] = e;
      if (Object.keys(next).length) localStorage.setItem('scl_histo_layout', JSON.stringify(next));
      else localStorage.removeItem('scl_histo_layout');
      return next;
    });
  };
  // Only non-default values are stored, so an untouched histogram leaves no entry (clean reset state).
  const setHistoTransform = (key: string, dx: number, dy: number, sx: number, sy: number) => writeHistoEntry(key, e => {
    e.dx = dx || undefined; e.dy = dy || undefined; e.sx = sx === 1 ? undefined : sx; e.sy = sy === 1 ? undefined : sy;
  });
  const resetHisto = (key: string) => writeHistoEntry(key, e => { e.dx = undefined; e.dy = undefined; e.sx = undefined; e.sy = undefined; });
  const resetAllHistos = () => { setHistoLayout({}); localStorage.removeItem('scl_histo_layout'); setSelectedHisto(null); };
  // Excel-style column widths for the standard 4-column tables (Test Name / Results / Units /
  // Normal Ranges), as percentages summing to 100. Drag a column border to resize; saved as a
  // lab-wide template so every report uses the chosen layout.
  const [colWidths, setColWidths] = useState<number[]>(() => {
    try { if (layoutFresh()) { const v = JSON.parse(localStorage.getItem('scl_colw') || ''); if (colWidthsValid(v)) return v; } } catch { /* ignore */ }
    return [...COL_DEFAULT];
  });
  function startColResize(idx: number, e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation();
    const table = (e.currentTarget as HTMLElement).closest('table');
    const tableW = table?.getBoundingClientRect().width || 1;
    const startX = e.clientX;
    const startWidths = [...colWidths];
    let last = startWidths;
    const onMove = (ev: PointerEvent) => {
      const deltaPct = ((ev.clientX - startX) / tableW) * 100;
      const left = startWidths[idx] + deltaPct;
      const right = startWidths[idx + 1] - deltaPct;
      if (left < COL_MIN[idx] || right < COL_MIN[idx + 1]) return;   // keep both columns usable
      last = [...startWidths]; last[idx] = left; last[idx + 1] = right;
      setColWidths(last);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      localStorage.setItem('scl_colw', JSON.stringify(last));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
  // Nudge the boundary between column `idx` and the next, by a fixed step (header button).
  function nudgeCol(idx: number, dir: 'left' | 'right') {
    setColWidths(prev => {
      const step = dir === 'left' ? -3 : 3;
      const left = prev[idx] + step;
      const right = prev[idx + 1] - step;
      if (left < 6 || right < 6) return prev;
      const out = [...prev]; out[idx] = left; out[idx + 1] = right;
      localStorage.setItem('scl_colw', JSON.stringify(out));
      return out;
    });
  }
  // INDEPENDENT per-column horizontal position: the left padding (px) of each column's cells.
  // Moving a column left/right only affects THAT column — nothing is shared with neighbours.
  // Defaults mirror the original paddings (Test Name 0, Results 8, Units 8, Normal Ranges 56).
  const [colOffset, setColOffset] = useState<number[]>(() => {
    try { if (layoutFresh()) { const v = JSON.parse(localStorage.getItem('scl_coloff') || ''); if (Array.isArray(v) && v.length === 4) return v; } } catch { /* ignore */ }
    return [0, 8, 8, 56];
  });
  function moveColumn(i: number, dir: 'left' | 'right') {
    setColOffset(prev => {
      const out = [...prev];
      out[i] = Math.max(0, Math.min(280, out[i] + (dir === 'left' ? -8 : 8)));
      localStorage.setItem('scl_coloff', JSON.stringify(out));
      return out;
    });
  }
  // Widen/narrow ONE column by `delta` %, taking the difference from the OTHER THREE columns
  // PROPORTIONALLY so the row always sums to 100% and stays balanced (you can't accidentally
  // blow one column up to 32% while another collapses).
  function adjustColWidth(i: number, delta: number) {
    setColWidths(prev => {
      const me = prev[i] + delta;
      if (me < COL_MIN[i] || me > 70) return prev;
      const otherTotal = prev.reduce((s, w, j) => s + (j === i ? 0 : w), 0);
      if (otherTotal <= 0) return prev;
      const out = prev.map((w, j) => j === i ? me : w - delta * (w / otherTotal));
      if (out.some((w, j) => j !== i && w < COL_MIN[j])) return prev;   // keep every column usable
      localStorage.setItem('scl_colw', JSON.stringify(out));
      return out;
    });
  }
  // Overall content scale (0.6–1.15): shrinks/grows ALL report content so it fits the page —
  // pagination accounts for it, so scaling down packs more onto each sheet.
  const [contentScale, setContentScale] = useState(() => { const v = Number(localStorage.getItem('scl_content_scale')); return (layoutFresh() && v >= 0.6 && v <= 1.15) ? v : 1; });
  const setScale = (v: number) => { const s = Math.min(1.15, Math.max(0.6, +v.toFixed(2))); setContentScale(s); localStorage.setItem('scl_content_scale', String(s)); };
  // Per-page manual resize: independent width (sx) and height (sy) scale factors. null entry
  // (or absent) → use the page's auto-fit scale. Applied as a CSS transform so it survives
  // PDF capture (pdf.ts only neutralises `zoom`, not `transform`).
  // Persisted PER PATIENT (like page breaks & deleted remarks) so a report's manual page
  // resizing survives a reload or patient switch — not wiped each time.
  const readPageScales = (id: number): Record<number, { sx: number; sy: number }> => {
    try { const v = JSON.parse(localStorage.getItem(`scl_pagescale_${id}`) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  };
  const [pageScaleOverrides, setPageScaleOverrides] = useState<Record<number, { sx: number; sy: number }>>(() => readPageScales(pid));
  const persistPageScales = (next: Record<number, { sx: number; sy: number }>) => {
    if (Object.keys(next).length) localStorage.setItem(`scl_pagescale_${pid}`, JSON.stringify(next));
    else localStorage.removeItem(`scl_pagescale_${pid}`);
  };
  const handlePageScaleChange = (idx: number, sx: number, sy: number) => setPageScaleOverrides(prev => { const next = { ...prev, [idx]: { sx, sy } }; persistPageScales(next); return next; });
  const resetPageScale = (idx: number) => setPageScaleOverrides(prev => { const n = { ...prev }; delete n[idx]; persistPageScales(n); return n; });
  // Load THIS patient's saved page resizing when the patient changes.
  useEffect(() => { setPageScaleOverrides(readPageScales(pid)); }, [pid]);
  // Excel-style deselect: a click anywhere outside a histogram (and not on its handles) clears the
  // selection. Plain listener — never preventDefault/stopPropagation — so caret/text is untouched.
  useEffect(() => {
    if (editing) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('[data-histo-anchor]') || t.closest('[data-report-control]'))) return;
      setSelectedHisto(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [editing]);
  // Per-column horizontal alignment for the 4 standard columns.
  const [colAlign, setColAlign] = useState<('left' | 'center' | 'right')[]>(() => {
    try { if (layoutFresh()) { const v = JSON.parse(localStorage.getItem('scl_colalign') || ''); if (Array.isArray(v) && v.length === 4) return v; } } catch { /* ignore */ }
    return ['left', 'left', 'left', 'left'];
  });
  const cycleAlign = (i: number) => setColAlign(prev => {
    const order: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
    const out = [...prev]; out[i] = order[(order.indexOf(prev[i]) + 1) % 3];
    localStorage.setItem('scl_colalign', JSON.stringify(out));
    return out;
  });
  // Row vertical padding (line spacing / density) in px.
  const [rowPad, setRowPad] = useState(() => { const v = Number(localStorage.getItem('scl_rowpad')); return (layoutFresh() && v >= 0 && v <= 10) ? v : 3; });
  const setRowPadding = (v: number) => { const p = Math.min(10, Math.max(0, Math.round(v))); setRowPad(p); localStorage.setItem('scl_rowpad', String(p)); };
  const autoDeliverTried = useRef(false);
  const autoSendTried = useRef(false);
  const [searchParams] = useSearchParams();

  const { data: patient } = useQuery({ queryKey: ['patient', pid], queryFn: () => getPatientById(pid) });
  const { data: orders = [] } = useQuery({ queryKey: ['orders', pid], queryFn: () => getOrdersWithResults(pid) });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getAllSettings });
  const { data: bill } = useQuery({ queryKey: ['bill', pid], queryFn: () => getBill(pid) });
  const { data: comment = '' } = useQuery({ queryKey: ['comment', pid], queryFn: () => getReportComment(pid) });
  const { data: histograms } = useQuery({ queryKey: ['histograms', pid], queryFn: () => getHistograms(pid) });
  const { data: rawOverride } = useQuery({ queryKey: ['report-override', pid], queryFn: () => getReportOverride(pid) });
  // Older builds (the TipTap experiment) could save a flattened/garbled override with no real
  // table. Treat such an override as invalid → fall back to the clean auto-generated report.
  const overrideValid = !!rawOverride && /<table/i.test(rawOverride);
  const reportOverride = overrideValid ? rawOverride : null;
  const { data: qr = '' } = useQuery({
    queryKey: ['qr', pid, patient?.test_no, patient?.report_time],
    queryFn: () => generateReportQR(patient!.test_no, patient!.name, patient!.report_time),
    enabled: !!patient,
  });

  const activeOrders = orders.filter(o => !o.order.not_done);
  // Calculated rows (e.g. A/G Ratio) are derived and may be blank when their inputs don't
  // allow a value — they must NOT gate approval. Only entered (non-calculated) tests do.
  const gatingOrders = activeOrders.filter(o => o.test.result_type !== 'calculated');
  // report_time is the authoritative approval flag (set atomically by approvePatient, cleared
  // by unlock). Keying off it — instead of re-deriving from every row's approved_at — keeps the
  // report page consistent with result-entry and stays correct even for all-not-done patients
  // (where there are no gating rows to inspect). handleApprove still guards the zero-result case.
  const isApproved = !!patient?.report_time;

  // Auto-deliver the report ONCE, right after it is approved — emailed to every patient who
  // has an email + SMTP set up, and (when the WhatsApp Cloud API is configured) sent on
  // WhatsApp to every patient with a phone. Runs the two sequentially so they never rasterise
  // the report at the same time, and dedupes via the delivery log so it never re-sends.
  useEffect(() => {
    if (autoDeliverTried.current) return;
    if (!isApproved || !patient || !orders.length) return;
    if (searchParams.get('send')) return;   // opened from the tray for a manual send — handled below
    const emailReady = !!patient.email && !!settings.smtp_host && !!settings.smtp_user && !!settings.smtp_pass;
    const waApiReady = !!patient.phone && settings.whatsapp_mode === 'api' && !!settings.bsp_api_key && !!settings.wa_phone_id;
    if (!emailReady && !waApiReady) return;
    autoDeliverTried.current = true;
    (async () => {
      await new Promise(r => setTimeout(r, 900));   // let the report DOM + QR settle before rasterising
      if (emailReady && !(await hasDelivered(pid, 'email'))) {
        setBusy('email');
        try {
          await emailCore();
          await logDelivery(pid, 'email', patient.email!, 'sent');
          setSent(s => ({ ...s, email: true }));
          toast.success('Report emailed to the patient.');
        } catch (e) {
          await logDelivery(pid, 'email', patient.email!, 'failed', String(e));
          toast.error(`Auto-email failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (waApiReady && !(await hasDelivered(pid, 'whatsapp_api'))) {
        setBusy('whatsapp');
        try {
          const pdfPath = await makePdf();
          if (!pdfPath) throw new Error('Could not generate the report PDF.');
          const { sendWhatsAppDocument } = await import('@/lib/whatsapp');
          await sendWhatsAppDocument({
            token: settings.bsp_api_key!, phoneNumberId: settings.wa_phone_id!,
            apiVersion: settings.wa_api_version || 'v21.0', to: patient.phone!,
            pdfPath, filename: `SCL-Report-${patient.test_no}.pdf`,
            caption: buildWhatsAppMessage({
              title: patient.title, name: patient.name, tests: panelSummary(),
              technicianName: settings.technician_name || settings.lab_name || 'the laboratory',
              technicianQual: settings.technician_qual ?? '', labName: settings.lab_name || 'the laboratory',
            }),
          });
          await logDelivery(pid, 'whatsapp_api', `91${patient.phone}`, 'sent');
          setSent(s => ({ ...s, whatsapp: true }));
          toast.success('Report sent on WhatsApp.');
        } catch (e) {
          await logDelivery(pid, 'whatsapp_api', `91${patient.phone}`, 'failed', String(e));
          toast.error(`Auto WhatsApp failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      setBusy(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproved, patient?.email, patient?.phone, orders.length, settings.smtp_host, settings.smtp_user, settings.smtp_pass, settings.whatsapp_mode, settings.bsp_api_key, settings.wa_phone_id]);

  // Opened from the dashboard "Waiting to Send" tray with ?send=whatsapp|print — run it
  // here, where the report is rendered and the PDF can actually be produced.
  useEffect(() => {
    const action = searchParams.get('send');
    if (!action || autoSendTried.current) return;
    if (!isApproved || !patient || !orders.length) return;
    autoSendTried.current = true;
    const t = setTimeout(async () => {
      if (action === 'whatsapp') {
        // Don't auto-resend if this report was already delivered on WhatsApp.
        if (await hasDelivered(pid, 'whatsapp_api') || await hasDelivered(pid, 'whatsapp_semi')) return;
        handleWhatsApp();
      } else if (action === 'print') handlePrint();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isApproved, patient, orders.length]);

  // Build the numeric values map (by test code) for calculated rows.
  const enteredMap: Record<string, number | null> = {};
  for (const o of orders) {
    if (o.result?.value) {
      const n = parseFloat(o.result.value.replace(/,/g, ''));
      if (!isNaN(n)) enteredMap[o.test.code] = n;
    }
  }
  // Fold calculated values back in so ratios that depend on other derived values
  // (A/G ratio via GLO, LDL/HDL ratio via LDL) resolve instead of printing blank.
  const calcTests = orders
    .filter(o => o.test.result_type === 'calculated' && o.test.formula)
    .map(o => ({ code: o.test.code, formula: o.test.formula }));
  const calcCtx = patient
    ? { ageYears: patientAgeDays(patient.age, patient.age_unit) / 365.25, sex: patient.sex }
    : undefined;
  const valuesMap = resolveCalculated(enteredMap, calcTests, calcCtx);

  // Group active orders by panel, preserving panel sort order. Only tests that actually have a
  // value are printed — un-entered / blank rows (e.g. a calculated row whose inputs are missing,
  // or a sub-test the lab chose to leave empty) are left off the report entirely. A panel whose
  // every test is blank therefore drops off too.
  const panelMap = new Map<string, { panel: Panel; orders: OrderWithResult[] }>();
  for (const o of activeOrders) {
    if (!resultValue(o).trim()) continue;
    const code = o.test.panel_code ?? 'MISC';
    if (!panelMap.has(code)) {
      const p = panels.find(pp => pp.code === code)
        ?? { id: 0, code, name: code, report_heading: code, sort_order: 99, page_break_after: 0 };
      panelMap.set(code, { panel: p, orders: [] });
    }
    panelMap.get(code)!.orders.push(o);
  }
  const sortedPanels = [...panelMap.values()].sort((a, b) => a.panel.sort_order - b.panel.sort_order);

  function resultValue(o: OrderWithResult): string {
    if (o.test.result_type === 'calculated' && o.test.formula) {
      const c = computeCalculated(o.test.code, o.test.formula, valuesMap, calcCtx);
      if (c == null) return '';
      if (typeof c === 'string') return c;
      return c.toFixed(safeDecimals(o.test.decimals));
    }
    return o.result?.value ?? '';
  }

  function rangeText(o: OrderWithResult): string {
    if (!patient) return '';
    if (o.order.range_override) return o.order.range_override;
    return displayRange(findRange(o.ranges, patient.sex, patientAgeDays(patient.age, patient.age_unit)));
  }

  // Shared report-table fragments (used by both grouped and one-per-page layouts).
  const HEAD_LABELS = ['Test Name', 'Results', 'Units', 'Normal Ranges'];
  // RIGHT padding only — the LEFT padding is the adjustable per-column position (colOffset).
  const HEAD_PAD = ['pr-4', 'pr-5', 'pr-2', 'pr-2'];
  // One header cell with: ←/→ buttons to shift the column boundary (like the test up/down
  // buttons) AND a drag handle for fine Excel-style resizing. data-report-control → stripped
  // from PDF/print/edit.
  const colHeaderCell = (label: string, i: number, extraClass = '') => (
    <th key={i} className={cn("pb-1 font-bold text-black text-[14.5px] relative group/col whitespace-nowrap", HEAD_PAD[i], extraClass)} style={{ textAlign: colAlign[i], paddingLeft: colOffset[i] }}>
      {label}
      {i < 3 && (
        <>
          {/* ←/→ shift buttons (appear on hover over the column header) */}
          <span data-report-control contentEditable={false}
            className="report-control absolute -top-2 right-1 z-30 flex gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity print:hidden">
            <button type="button" title="Shift boundary left (narrower)" onClick={() => nudgeCol(i, 'left')}
              className="h-5 w-5 inline-flex items-center justify-center rounded border border-[#e6e7ee] bg-white text-[#3a3b45] shadow-sm hover:border-[#c7c9ff] hover:text-[#4f46e5]">‹</button>
            <button type="button" title="Shift boundary right (wider)" onClick={() => nudgeCol(i, 'right')}
              className="h-5 w-5 inline-flex items-center justify-center rounded border border-[#e6e7ee] bg-white text-[#3a3b45] shadow-sm hover:border-[#c7c9ff] hover:text-[#4f46e5]">›</button>
          </span>
          {/* drag handle on the boundary */}
          <span data-report-control contentEditable={false} onPointerDown={e => startColResize(i, e)}
            title="Drag to resize this column" style={{ touchAction: 'none' }}
            className="report-control absolute top-0 right-0 z-20 h-full w-3 translate-x-1/2 cursor-col-resize print:hidden">
            <span className="block mx-auto h-full w-[2px] bg-[#c7c9ff] opacity-0 group-hover/col:opacity-100 transition-opacity" />
          </span>
        </>
      )}
    </th>
  );
  const renderHead = () => (
    <>
      <colgroup>
        {colWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
      </colgroup>
      <thead>
        <tr className="border-b border-gray-400">
          {HEAD_LABELS.map((label, i) => colHeaderCell(label, i))}
        </tr>
      </thead>
    </>
  );
  // A test's interpretation box, rendered as a full-width row DIRECTLY BELOW that test.
  const noteRow = (o: OrderWithResult) => (o.test.interpretation_note && !hiddenNotes.has(o.order.id)) ? (
    <tr key={`note-${o.order.id}`} data-note-row>
      <td colSpan={4} className="pt-1 pb-2">
        <div className="group/note relative border border-gray-700 px-3 py-2 text-[12px] text-gray-900 leading-[1.25] whitespace-pre-line [font-family:'Times_New_Roman',Georgia,serif]">
          {o.test.interpretation_note}
          <button data-report-control contentEditable={false} onClick={() => hideNote(o.order.id)}
            title="Delete this remark box" aria-label="Delete remark"
            className="report-control absolute -top-2 -right-2 z-10 h-5 w-5 inline-flex items-center justify-center rounded-full border border-[#f0d3d3] bg-white text-[13px] leading-none text-[#b91c1c] shadow-sm opacity-0 group-hover/note:opacity-100 transition-opacity print:hidden">×</button>
        </div>
      </td>
    </tr>
  ) : null;
  const renderRows = (rows: OrderWithResult[]) => rows.flatMap(o => {
    const value = resultValue(o);
    const ageDays = patient ? patientAgeDays(patient.age, patient.age_unit) : 0;
    const range = rangeText(o);
    const matchedRange = patient ? findRange(o.ranges, patient.sex, ageDays) : null;
    const unit = o.order.unit_override || matchedRange?.unit || o.test.unit;
    // Auto-bold out-of-range results (low OR high) so they stand out — the test name and the
    // value both go bold, matching the CBC layout.
    const flag = patient ? computeFlag(o.test.result_type, value, rangesWithOverride(o.ranges, o.order.range_override), patient.sex, ageDays) : '';
    const isAbnormal = flag === 'H' || flag === 'L';
    const cells = [o.test.name, value || '—', (unit && unit !== '—' ? unit : ''), range.replace(/ \/ /g, "\n")];
    const tr = (
      <tr key={o.order.id}>
        {cells.map((c, i) => (
          <td
            key={i}
            className={cn("align-top", HEAD_PAD[i], i === 1 && "tabular-nums",
              i < 2 ? (isAbnormal ? "font-bold text-black" : "text-gray-950") : "text-gray-800",
              i === 2 && "whitespace-nowrap", i === 3 && "whitespace-pre-line")}
            style={{ paddingTop: rowPad, paddingBottom: rowPad, paddingLeft: colOffset[i], textAlign: colAlign[i] }}
          >
            {c}
          </td>
        ))}
      </tr>
    );
    const nr = noteRow(o);
    return nr ? [tr, nr] : [tr];
  });

  /** Column header row for CBC tables — 5 columns (4 data + 1 histogram). The 4 data columns
   *  share the adjustable colWidths (so the ←/→ buttons & drag work here too, fixing the
   *  too-narrow "Results" column); the histogram column is a fixed 62 mm. */
  const CBC_HISTO_MM = 62;
  const CBC_DATA_MM = 124;   // 186mm body − 62mm histogram
  const renderCbcHead = () => (
    <>
      <colgroup>
        {colWidths.map((w, i) => <col key={i} style={{ width: `${(w / 100 * CBC_DATA_MM).toFixed(1)}mm` }} />)}
        <col style={{ width: `${CBC_HISTO_MM}mm` }} />
      </colgroup>
      <thead>
        <tr>
          {HEAD_LABELS.map((label, i) => colHeaderCell(label, i))}
          <th style={{ width: `${CBC_HISTO_MM}mm` }}></th>
        </tr>
      </thead>
    </>
  );

  /** CBC renderer: each section's histogram sits in a rowspan cell next to its rows,
   *  so WBC/RBC/PLT charts align exactly with LEUKOCYTES/ERYTHROCYTES/THROMBOCYTES. */
  const renderCbcWithHistograms = (allRows: OrderWithResult[]) => {
    if (!patient) return renderRows(allRows);
    const ageDays = patientAgeDays(patient.age, patient.age_unit);

    type SGroup = { section: string; rows: OrderWithResult[] };
    const groups: SGroup[] = [];
    for (const o of allRows) {
      const sec = CBC_SECTION[o.test.code] ?? '';
      const last = groups[groups.length - 1];
      if (!last || last.section !== sec) groups.push({ section: sec, rows: [o] });
      else last.rows.push(o);
    }

    return groups.flatMap(({ section, rows: sRows }) => {
      const hasChart = section === 'LEUKOCYTES' || section === 'ERYTHROCYTES' || section === 'THROMBOCYTES';
      const spanCount = sRows.length + 1; // section header + its data rows
      const headerRow = section ? (
        <tr key={`hdr-${section}`}>
          <td colSpan={4} className="pt-2 pb-[2px] text-[11px] font-bold text-black uppercase tracking-wide border-b border-gray-500">
            {section}
          </td>
          {hasChart && (
            <td rowSpan={spanCount} style={{ verticalAlign: 'middle', paddingLeft: '4mm', position: 'relative', overflow: 'visible' }}>
              <MovableHistogram
                histoKey={SECTION_TO_HISTO[section]}
                entry={histoLayout[SECTION_TO_HISTO[section]]}
                selected={selectedHisto === SECTION_TO_HISTO[section]}
                editing={editing}
                onSelect={() => setSelectedHisto(SECTION_TO_HISTO[section])}
                onChange={(dx, dy, sx, sy) => setHistoTransform(SECTION_TO_HISTO[section], dx, dy, sx, sy)}
                onReset={() => resetHisto(SECTION_TO_HISTO[section])}
              >
                <CbcSectionHistogram section={section} orders={allRows} histos={histograms} />
              </MovableHistogram>
            </td>
          )}
        </tr>
      ) : null;
      const dataRows = sRows.map(o => {
        const value = resultValue(o);
        const flag = computeFlag(o.test.result_type, value, rangesWithOverride(o.ranges, o.order.range_override), patient.sex, ageDays);
        const isAbnormal = flag === 'H' || flag === 'L';
        const range = rangeText(o);
        const matchedRange = findRange(o.ranges, patient.sex, ageDays);
        const unit = o.order.unit_override || matchedRange?.unit || o.test.unit;
        return (
          <tr key={o.order.id}>
            <td className={cn("align-top", HEAD_PAD[0], isAbnormal ? "font-bold text-black" : "text-gray-950")}
              style={{ paddingTop: rowPad, paddingBottom: rowPad, paddingLeft: colOffset[0], textAlign: colAlign[0] }}>
              {o.test.name}
            </td>
            <td className={cn("align-top tabular-nums", HEAD_PAD[1], isAbnormal ? "font-bold text-black" : "text-gray-950")}
              style={{ paddingTop: rowPad, paddingBottom: rowPad, paddingLeft: colOffset[1], textAlign: colAlign[1] }}>
              {value || '—'}
            </td>
            <td className={cn("align-top text-gray-800 whitespace-nowrap", HEAD_PAD[2])}
              style={{ paddingTop: rowPad, paddingBottom: rowPad, paddingLeft: colOffset[2], textAlign: colAlign[2] }}>
              {unit && unit !== '—' ? unit : ''}
            </td>
            <td className={cn("align-top text-gray-800 whitespace-pre-line", HEAD_PAD[3])}
              style={{ paddingTop: rowPad, paddingBottom: rowPad, paddingLeft: colOffset[3], textAlign: colAlign[3] }}>
              {range.replace(/ \/ /g, "\n")}
            </td>
          </tr>
        );
      });
      return headerRow ? [headerRow, ...dataRows] : dataRows;
    });
  };

  /** Sectioned renderer: inserts sub-section headers (PHYSICAL / CHEMICAL / MICROSCOPIC …)
   *  before the rows of each section. Shared by URINE, STOOL and SEMEN. */
  const renderSectionedRows = (rows: OrderWithResult[], sectionMap: Record<string, string>) => {
    const out: React.ReactNode[] = [];
    let currentSection = '';
    for (const o of rows) {
      const section = sectionMap[o.test.code] ?? '';
      if (section && section !== currentSection) {
        currentSection = section;
        out.push(
          <tr key={`usec-${section}`}>
            <td colSpan={4} className="pt-2 pb-[2px] text-[11px] font-bold text-black uppercase tracking-wide border-b border-gray-500">
              {section}
            </td>
          </tr>
        );
      }
      const value = resultValue(o);
      const ageDays = patient ? patientAgeDays(patient.age, patient.age_unit) : 0;
      const range = rangeText(o);
      const matchedRange = patient ? findRange(o.ranges, patient.sex, ageDays) : null;
      const unit = o.order.unit_override || matchedRange?.unit || o.test.unit;
      // Auto-bold out-of-range numeric results, matching the standard renderRows. computeFlag
      // no-ops on text results (Nil/Positive/Trace), so qualitative rows stay normal.
      const flag = patient ? computeFlag(o.test.result_type, value, rangesWithOverride(o.ranges, o.order.range_override), patient.sex, ageDays) : '';
      const isAbnormal = flag === 'H' || flag === 'L';
      const cells = [o.test.name, value || '—', (unit && unit !== '—' ? unit : ''), range.replace(/ \/ /g, "\n")];
      out.push(
        <tr key={o.order.id}>
          {cells.map((c, i) => (
            <td
              key={i}
              className={cn("align-top", HEAD_PAD[i], i === 1 && "tabular-nums", i < 2 ? (isAbnormal ? "font-bold text-black" : "text-gray-950") : "text-gray-800", i === 2 && "whitespace-nowrap", i === 3 && "whitespace-pre-line")}
              style={{ paddingTop: rowPad, paddingBottom: rowPad, paddingLeft: colOffset[i], textAlign: colAlign[i] }}
            >
              {c}
            </td>
          ))}
        </tr>
      );
      const nr = noteRow(o);
      if (nr) out.push(nr);
    }
    return out;
  };

  // skipPerTest: per-test interpretation boxes are now rendered INLINE (right under each test),
  // so the standard/urine tables pass true and this only emits the panel-wide band text.
  const renderNotes = (rows: OrderWithResult[], skipPerTest = false) => {
    // Interpretation boxes print AFTER the whole test table (never between rows) — one box per
    // test that carries an interpretation, in order. Plus the patient-matched band text.
    const ageDays = patient ? patientAgeDays(patient.age, patient.age_unit) : 0;
    const band = patient
      ? rows.map(r => findRange(r.ranges, patient.sex, ageDays)?.band_text).find(Boolean)
      : undefined;
    const notes = skipPerTest ? [] : rows.filter(r => r.test.interpretation_note && !hiddenNotes.has(r.order.id));
    if (!band && notes.length === 0) return null;
    return (
      <>
        {band && <div className="mt-1 text-[12px] text-gray-800 whitespace-pre-line">{band}</div>}
        {notes.map(r => (
          <div key={r.order.id} className="group/note relative mt-2 border border-gray-700 px-3 py-2 text-[12px] text-gray-900 leading-[1.25] whitespace-pre-line [font-family:'Times_New_Roman',Georgia,serif]">
            {r.test.interpretation_note}
            <button data-report-control contentEditable={false} onClick={() => hideNote(r.order.id)}
              title="Delete this remark box" aria-label="Delete remark"
              className="report-control absolute -top-2 -right-2 z-10 h-5 w-5 inline-flex items-center justify-center rounded-full border border-[#f0d3d3] bg-white text-[13px] leading-none text-[#b91c1c] shadow-sm opacity-0 group-hover/note:opacity-100 transition-opacity print:hidden">×</button>
          </div>
        ))}
      </>
    );
  };

  /** The body of one panel (table + interpretation notes), shared by every layout mode. */
  const renderPanelBody = (pg: { panel: Panel; orders: OrderWithResult[] }) =>
    pg.panel.code === 'CBC' ? (
      <>
        <table className="w-full text-[14px] border-collapse" style={{ tableLayout: 'fixed' }}>
          {renderCbcHead()}
          <tbody>{renderCbcWithHistograms(pg.orders)}</tbody>
        </table>
        {renderNotes(pg.orders)}
      </>
    ) : pg.panel.code === 'URINE' || pg.panel.code === 'STOOL' || pg.panel.code === 'SEMEN' ? (
      <>
        <table className="w-full table-fixed text-[14px] border-collapse">
          {renderHead()}
          <tbody>{renderSectionedRows(pg.orders, pg.panel.code === 'STOOL' ? STOOL_SECTION : pg.panel.code === 'SEMEN' ? SEMEN_SECTION : URINE_SECTION)}</tbody>
        </table>
        {renderNotes(pg.orders, true)}
      </>
    ) : (
      <>
        <table className="w-full table-fixed text-[14px] border-collapse">
          {renderHead()}
          <tbody>{renderRows(pg.orders)}</tbody>
        </table>
        {renderNotes(pg.orders, true)}
      </>
    );

  async function withLog(channel: 'print' | 'pdf' | 'whatsapp_semi' | 'whatsapp_api' | 'email' | 'sms', target: string, key: string, fn: () => Promise<void> | void) {
    setBusy(key);
    try {
      await fn();
      await logDelivery(pid, channel, target, 'sent');
      setSent(s => ({ ...s, [key]: true }));
    } catch (err) {
      await logDelivery(pid, channel, target, 'failed', String(err));
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  function reportEl(): HTMLElement {
    const el = document.getElementById('report-print-area');
    if (!el) throw new Error('Report not ready.');
    return el;
  }

  async function makePdf(): Promise<string> {
    const el = reportEl();
    // Digital copies (PDF / WhatsApp / Email) ALWAYS include the full letterhead, even
    // when the on-screen preview is in "no letterhead" mode for pre-printed paper.
    const hadNoLetterhead = el.classList.contains('no-letterhead');
    if (hadNoLetterhead) el.classList.remove('no-letterhead');
    // Hide the on-screen move controls during rasterisation (they're screen-only, but
    // html2canvas captures the screen DOM, so print:hidden alone won't drop them).
    const controls = Array.from(el.querySelectorAll<HTMLElement>('[data-report-control]'));
    controls.forEach(c => { c.style.display = 'none'; });
    try {
      // wait two frames so the full-letterhead layout actually paints before rasterising
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      // and wait for every image (logo, signature, QR) to finish decoding, so they are
      // never missing from a manually-saved / WhatsApp / Email PDF (a refetch-timing race).
      await Promise.all(
        Array.from(el.querySelectorAll('img')).map(img =>
          img.decode().catch(() => undefined)
        )
      );
      return await saveReportPdf({
        element: el,
        testNo: patient!.test_no,
        name: patient!.name,
        reportDate: patient!.report_time,
      });
    } finally {
      if (hadNoLetterhead) el.classList.add('no-letterhead');
      controls.forEach(c => { c.style.display = ''; });
    }
  }

  const panelSummary = () => sortedPanels.map(p => p.panel.report_heading).join(', ') || 'Lab Report';

  function handlePrint() {
    const isWindows = /win/i.test(navigator.userAgent);
    if (isWindows) {
      // Windows WebView2 shows the native print dialog directly (like Ctrl+P in Word).
      window.print();
      logDelivery(pid, 'print', settings.printer_name ?? 'Default printer', 'sent').catch(() => {});
      setSent(s => ({ ...s, print: true }));
      return;
    }
    // macOS WKWebView ignores window.print(), so render the report to a PDF and open it in
    // Preview — pressing ⌘P there shows the print dialog and lets you pick the printer.
    withLog('print', settings.printer_name ?? 'Default printer', 'print', async () => {
      await printReportPdf({ element: reportEl(), testNo: patient!.test_no, name: patient!.name });
    });
  }

  function handlePdf() {
    withLog('pdf', 'Documents/SCL Reports', 'pdf', async () => {
      const path = await makePdf();
      if (path) {
        await revealInFolder(path);
        toast.success('PDF saved to your reports folder.');
      }
    });
  }

  // Build the serializable model the .docx generator consumes, reusing the SAME value/range/
  // flag/unit logic as the on-screen report so the Word file matches the preview exactly.
  function buildDocxModel(): ReportDocxModel {
    const ageDays = patient ? patientAgeDays(patient.age, patient.age_unit) : 0;
    const toRow = (o: OrderWithResult): DocxRow => {
      const value = resultValue(o);
      const matched = patient ? findRange(o.ranges, patient.sex, ageDays) : null;
      const unit = o.order.unit_override || matched?.unit || o.test.unit || '';
      const flag = patient ? computeFlag(o.test.result_type, value, rangesWithOverride(o.ranges, o.order.range_override), patient.sex, ageDays) : '';
      return {
        name: o.test.name,
        value: value || '—',
        unit: unit && unit !== '—' ? unit : '',
        range: rangeText(o).replace(/ \/ /g, '\n'),
        abnormal: flag === 'H' || flag === 'L',
        note: hiddenNotes.has(o.order.id) ? null : (o.test.interpretation_note || null),
      };
    };
    const bandFor = (orders: OrderWithResult[]) =>
      patient ? orders.map(r => findRange(r.ranges, patient.sex, ageDays)?.band_text).find(Boolean) ?? null : null;
    const groupSections = (orders: OrderWithResult[], map: Record<string, string>): DocxSubSection[] => {
      const out: DocxSubSection[] = [];
      for (const o of orders) {
        const label = map[o.test.code] ?? '';
        let sec = out[out.length - 1];
        if (!sec || sec.label !== label) { sec = { label, rows: [] }; out.push(sec); }
        sec.rows.push(toRow(o));
      }
      return out;
    };

    let prevDept = '';
    const panels: DocxPanel[] = sortedPanels.map(({ panel, orders }) => {
      const dept = deptOf(panel);
      const showDept = dept !== prevDept; prevDept = dept;
      const heading = sameHeading(panel.report_heading, dept) ? undefined : panel.report_heading;
      const bandText = bandFor(orders);
      if (panel.code === 'CBC') return { code: panel.code, dept, showDept, heading, layout: 'cbc', sections: groupSections(orders, CBC_SECTION), bandText };
      if (panel.code === 'URINE') return { code: panel.code, dept, showDept, heading, layout: 'urine', sections: groupSections(orders, URINE_SECTION), bandText };
      if (panel.code === 'STOOL') return { code: panel.code, dept, showDept, heading, layout: 'urine', sections: groupSections(orders, STOOL_SECTION), bandText };
      if (panel.code === 'SEMEN') return { code: panel.code, dept, showDept, heading, layout: 'urine', sections: groupSections(orders, SEMEN_SECTION), bandText };
      return { code: panel.code, dept, showDept, heading, layout: 'standard', rows: orders.map(toRow), bandText };
    });

    const g = genderLabel(patient!.sex, patient!.baby);
    const patientPairs: [string, string][] = [
      ['Name', `${patient!.title} ${patient!.name}`],
      ['Test Request ID', String(patient!.test_no)],
      ['Age/Gender', `${patient!.age} ${patient!.age_unit} / ${g}`],
      ['Sample Collected ON', formatDate(patient!.sample_time)],
      ['Collected AT', patient!.collected_at ?? ''],
      ['Sample Received ON', formatDate(patient!.sample_time)],
      ['Referred By', patient!.doctor_name ?? 'SELF'],
      ['Report DATE', formatDate(patient!.report_time)],
    ];
    return { patientPairs, panels, comment: comment || undefined };
  }

  function handleDocx() {
    withLog('pdf', 'Documents/SCL Reports', 'docx', async () => {
      const model = buildDocxModel();
      const histogramPngs = await rasterizeHistograms(sortedPanels, histograms);
      const path = await exportReportDocx({
        model, settings, histogramPngs, qr,
        testNo: patient!.test_no, name: patient!.name, reportDate: patient!.report_time,
        // Mirror the on-screen "Print lab letterhead" switch: when OFF, the lab prints on
        // pre-printed stationery, so the .docx omits header/footer and uses blank gaps instead.
        // Also carry the tuned column widths/alignment so Word matches the preview.
        layout: { noLetterhead: !printLetterhead, preTopMm: preTop, preBottomMm: preBottom, colWidths, colAlign, showSignature, sigHeightMm, sigBottomMm, sigRightMm },
      });
      if (path) { await revealInFolder(path); toast.success('Word document saved & opened.'); }
    });
  }

  function handleWhatsApp() {
    if (!patient?.phone) return;
    const msg = buildWhatsAppMessage({
      title: patient.title, name: patient.name, tests: panelSummary(),
      // Sign with the lab's own signatory, falling back to the lab name — NEVER a hardcoded
      // person (that leaked one tenant's signatory onto every other lab's messages).
      technicianName: settings.technician_name || settings.lab_name || 'the laboratory',
      technicianQual: settings.technician_qual ?? '', labName: settings.lab_name || 'the laboratory',
    });
    // Fully-automatic Cloud API path (sends the actual PDF) when configured.
    const apiReady = settings.whatsapp_mode === 'api' && settings.bsp_api_key && settings.wa_phone_id;
    if (apiReady) {
      withLog('whatsapp_api', `91${patient.phone}`, 'whatsapp', async () => {
        const pdfPath = await makePdf();
        if (!pdfPath) throw new Error('Could not generate the report PDF.');
        const { sendWhatsAppDocument } = await import('@/lib/whatsapp');
        await sendWhatsAppDocument({
          token: settings.bsp_api_key!,
          phoneNumberId: settings.wa_phone_id!,
          apiVersion: settings.wa_api_version || 'v21.0',
          to: patient.phone,
          pdfPath,
          filename: `SCL-Report-${patient.test_no}.pdf`,
          caption: msg,
        });
        toast.success('Report sent on WhatsApp.');
      });
      return;
    }
    // Semi-automatic fallback (free, personal number): copy the actual report PDF to the
    // clipboard and open the WhatsApp Desktop chat with the text ready — the user pastes
    // (Ctrl/⌘+V) to attach the PDF as a document and presses Enter.
    withLog('whatsapp_semi', `91${patient.phone}`, 'whatsapp', async () => {
      const pdfPath = (await makePdf()) || undefined;
      const { copyPdfToClipboard } = await import('@/lib/whatsapp');
      if (pdfPath) await copyPdfToClipboard(pdfPath);
      await sendWhatsAppSemi(patient.phone, msg, pdfPath);
      if (pdfPath) {
        alert(
          'WhatsApp chat opened and the report PDF is on the clipboard.\n\n' +
          '1. Click into the chat\n' +
          '2. Press Ctrl + V  (⌘ + V on Mac) to attach the PDF\n' +
          '3. Press Enter to send.\n\n' +
          '(If paste doesn’t attach it, click the 📎 / attach button → Document → the highlighted file.)'
        );
      }
    });
  }

  function handleSms() {
    if (!patient?.phone) { toast.error('This patient has no mobile number on file.'); return; }
    if (!settings.sms_api_key || !settings.sms_sender_id) {
      toast.error('SMS is not set up yet. Go to Settings → SMS to configure it.');
      return;
    }
    withLog('sms', `91${patient.phone}`, 'sms', async () => {
      const { sendSms, buildSmsMessage } = await import('@/lib/sms');
      const patientName = `${patient.title} ${patient.name}`.trim();
      await sendSms({
        provider: settings.sms_provider ?? 'fast2sms',
        apiKey: settings.sms_api_key!,
        senderId: settings.sms_sender_id!,
        dltTemplateId: settings.sms_dlt_template_id ?? '',
        phone: patient.phone,
        message: buildSmsMessage({ name: patientName, testNo: patient.test_no, labName: settings.lab_name }),
        vars: [patientName, String(patient.test_no)],
      });
      toast.success('SMS sent.');
    });
  }

  // Core email send (no UI side-effects) — shared by the manual button and auto-on-approve.
  async function emailCore(): Promise<void> {
    const host = settings.smtp_host, port = settings.smtp_port, user = settings.smtp_user, pass = settings.smtp_pass;
    const pdfPath = await makePdf();
    // The whole point of the email is the attached report — never send "please find attached"
    // with nothing attached.
    if (!pdfPath) throw new Error('Could not generate the report PDF — email not sent.');
    const labName = settings.lab_name || 'the laboratory';
    const tech = settings.technician_name || labName;   // sign with the lab name if no signatory set — never Sharma
    const bodyHtml = `<div style="font-family:Inter,Arial,sans-serif;color:#14151c">
      <p>Dear ${esc(patient!.title)} ${esc(patient!.name)},</p>
      <p>Please find attached your laboratory report (${esc(panelSummary())}) from
      <b style="color:#7b1b1b">${esc(labName)}</b>${settings.address_line ? `, ${esc(settings.address_line)}` : ''}.</p>
      <p style="color:#6b7280;font-size:13px">This is a computer-generated report. For queries, contact the laboratory.</p>
      <p style="margin-top:18px">— ${esc(tech)}<br/>${esc(settings.technician_qual ?? '')}</p>
    </div>`;
    await sendEmail({
      host, port: parseInt(port, 10) || 587, username: user, password: pass,
      to: patient!.email!, subject: `Lab Report — ${patient!.title} ${patient!.name} (#${patient!.test_no})`,
      bodyHtml, pdfPath,
    });
  }

  function handleEmail() {
    if (!patient?.email) { toast.error('This patient has no email address on file.'); return; }
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      toast.error('Email is not set up yet. Go to Settings → Email to configure it.');
      return;
    }
    withLog('email', patient.email, 'email', async () => {
      await emailCore();
      toast.success('Email sent.');
    });
  }

  async function handleApprove() {
    if (!sessionUser || approving) return;
    if (gatingOrders.length === 0) {
      toast.error('There are no results to approve. Enter at least one test result first.');
      return;
    }
    setApproving(true);
    try {
      await approvePatient(pid, sessionUser.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['orders', pid] }),
        qc.invalidateQueries({ queryKey: ['patient', pid] }),
        qc.invalidateQueries({ queryKey: ['today-patients'] }),
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] }),
        qc.invalidateQueries({ queryKey: ['patients-search'] }),
        qc.invalidateQueries({ queryKey: ['pending-deliveries'] }),
      ]);
      toast.success('Report approved — you can now print or send it.');
    } catch (e) {
      toast.error(e);
    } finally {
      setApproving(false);
    }
  }

  // ── In-app report editing (in-place) ──
  // We edit the ACTUAL rendered report (so the editable preview looks EXACTLY like the print/PDF:
  // paginated, with the letterhead, name box & footer on every page). The chrome carries
  // contenteditable="false" so it stays locked; everything else is editable. The host is filled
  // and made editable IMPERATIVELY via a ref (React must not manage the editable DOM).
  function startEdit() {
    // Build the editor snapshot from EITHER the saved override OR the live rendered report, then
    // ALWAYS sanitise it so the editor flows content naturally. This must run on both sources —
    // a saved override can carry baked-in absolute-positioning + scale() transforms (from the
    // resize feature), and editing those raw would collapse/overlap/hide the content.
    const src = document.createElement('div');
    if (reportOverride) {
      src.innerHTML = reportOverride;
    } else {
      const el = document.getElementById('report-print-area');
      src.innerHTML = (el?.cloneNode(true) as HTMLElement | null)?.innerHTML ?? '';
    }
    // Drop on-screen move/resize controls.
    src.querySelectorAll('[data-report-control]').forEach(n => n.remove());
    // Undo the per-page resize transform/zoom so each section flows top-to-bottom (absolute +
    // scale() would otherwise collapse or hide the editable text). WebKit also corrupts caret
    // selection inside a zoomed contentEditable, so the editor always renders 1:1; print/PDF
    // re-fit each page to A4 from the saved HTML.
    src.querySelectorAll<HTMLElement>('[data-editable-body]').forEach(s => {
      s.style.zoom = ''; s.style.transform = ''; s.style.transformOrigin = '';
      s.style.position = ''; s.style.top = ''; s.style.left = ''; s.style.width = '';
    });
    // Collapse the per-page resize frame back to natural flow (drop its fixed scaled W/H).
    src.querySelectorAll<HTMLElement>('[data-scale-frame]').forEach(f => { f.style.width = ''; f.style.height = ''; });
    // Neutralise per-histogram move/resize transforms so they don't overlap text while editing
    // (the handles are already gone — they were data-report-control, stripped above).
    src.querySelectorAll<HTMLElement>('[data-histo-anchor] > div').forEach(d => { d.style.transform = ''; d.style.cursor = ''; });
    setEditHtml(src.innerHTML);
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); setEditHtml(null); }
  // Auto-heal: silently discard a leftover broken override so the patient shows the clean report.
  useEffect(() => {
    if (rawOverride && !overrideValid) {
      clearReportOverride(pid).then(() => qc.invalidateQueries({ queryKey: ['report-override', pid] })).catch(() => {});
    }
  }, [rawOverride, overrideValid, pid, qc]);
  // Fill the editable host imperatively and set up the GRID editing model:
  //   • the host itself is NOT contentEditable
  //   • each report body section (headings, notes, comments) IS editable text
  //   • table CELLS are NOT editable — they're grid cells. Selection/deselection is therefore
  //     crisp (no browser text-selection fighting us); you double-click / type to edit a cell.
  // This is what makes the experience feel like a real spreadsheet.
  useEffect(() => {
    if (!editing || editHtml == null) return;
    const host = editHostRef.current;
    if (!host) return;
    host.innerHTML = editHtml;
    host.contentEditable = 'false';
    host.spellcheck = false;
    // Editable text regions = the report body sections (NOT the letterhead / name box / footer).
    host.querySelectorAll<HTMLElement>('[data-editable-body]').forEach(b => { b.contentEditable = 'true'; b.spellcheck = false; });
    // Cells become non-editable grid cells (double-click to edit — handled by the toolbar).
    host.querySelectorAll<HTMLElement>('[data-editable-body] td, [data-editable-body] th').forEach(c => { c.contentEditable = 'false'; });
    // At natural size some pages can be taller than A4; the print layout clips them
    // (overflow:hidden) which would HIDE content while editing. Let pages grow so everything is
    // visible & editable — print/PDF re-fit each page to A4 from the saved HTML.
    host.querySelectorAll<HTMLElement>('.report-page').forEach(p => {
      p.style.overflow = 'visible';
      p.style.height = 'auto';
      p.style.minHeight = '297mm';
    });
  }, [editing, editHtml]);

  async function saveEditedBody(html: string) {
    try {
      await saveReportOverride(pid, html);
      await qc.invalidateQueries({ queryKey: ['report-override', pid] });
      setEditing(false);
      setEditHtml(null);
      toast.success("Saved. This edited report is what prints & sends.");
    } catch (e) { toast.error(e); }
  }
  function saveEdit() {
    const host = editHostRef.current;
    if (!host) { setEditing(false); return; }
    // Serialize from a CLONE so we can strip all editing-only artefacts (contentEditable flags,
    // selection/active/editing highlight classes) without disturbing the live editor — they must
    // never leak into the saved report / PDF / print.
    const clone = host.cloneNode(true) as HTMLElement;
    clone.removeAttribute('contenteditable');
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    clone.querySelectorAll('.report-cell-selected, .report-cell-editing').forEach(c => {
      c.classList.remove('report-cell-selected', 'report-cell-editing');
    });
    // Restore each page to a fixed A4 sheet — editing set them to height:auto/overflow:visible so
    // content was fully visible; saving that would let the page stretch past A4 and shove the
    // signature/footer down. Pin back to 297mm + overflow hidden in the stored report.
    clone.querySelectorAll<HTMLElement>('.report-page').forEach(p => {
      p.style.height = '297mm';
      p.style.minHeight = '297mm';
      p.style.overflow = 'hidden';
    });
    saveEditedBody(clone.innerHTML);
  }
  // Ctrl/Cmd + and − zoom the preview (and Ctrl/Cmd 0 resets) — like a browser/Word, so the
  // whole report can be scaled to fit the screen. Intercepts the WebView's own zoom.
  useEffect(() => {
    function onZoomKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => Math.min(200, z + 10)); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(z => Math.max(25, z - 10)); }
      else if (e.key === '0') { e.preventDefault(); setZoom(100); }
    }
    window.addEventListener('keydown', onZoomKey);
    return () => window.removeEventListener('keydown', onZoomKey);
  }, []);

  async function revertEdit() {
    try {
      await clearReportOverride(pid);
      await qc.invalidateQueries({ queryKey: ['report-override', pid] });
      setEditing(false);
      setEditHtml(null);
      toast.success("Reverted to the original report.");
    } catch (e) { toast.error(e); }
  }

  // NOTE: all hooks (incl. the useCallback chrome components below) MUST run before any early
  // return, or React throws "rendered more hooks than previous render" when patient loads.
  const genderText = genderLabel(patient?.sex, patient?.baby);
  const labName = settings.lab_name || 'YOUR LABORATORY';

  // These chrome components are wrapped in useCallback so their function identity stays STABLE
  // across the frequent layout-state changes (zoom, column sliders, row spacing). Without this
  // they'd be recreated every render, forcing React to remount them — which reloads the logo /
  // QR / signature images and races the pagination measurement. Deps = only what they render.
  const Watermark = useCallback(() => showWatermark ? (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      <span style={{ transform: 'rotate(-35deg)', fontSize: '46px', color: 'rgba(123,27,27,0.05)', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {labName}
      </span>
    </div>
  ) : null, [showWatermark, labName]);

  const Letterhead = useCallback(() => (
    <header contentEditable={false} suppressContentEditableWarning className="report-letterhead relative">
      <div className="flex items-start gap-3">
        {/* Only ever the lab's OWN uploaded logo (Settings → Branding). No baked-in fallback —
            a white-label report must never show another company's mark. */}
        {settings.logo_data && (
          <img src={settings.logo_data} alt={`${labName} logo`} className="h-[58px] w-auto object-contain shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h1 className="report-title text-[#7b1b1b]">{labName}</h1>
            {settings.address_line && (
              <p className="text-right text-[10.5px] font-bold uppercase text-gray-900 leading-tight pt-1 max-w-[210px]">
                {settings.address_line}
              </p>
            )}
          </div>
          {settings.tagline && (
            <div className="inline-block border-[1.5px] border-gray-900 rounded-md px-2.5 py-[1px] mt-1 text-[10.5px] font-extrabold tracking-wide text-gray-900">
              {settings.tagline}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 items-start mt-1.5 text-[10.5px] text-gray-900">
        <p className="font-bold text-[#7b1b1b] leading-snug whitespace-pre-line">
          {settings.phones ? `Mob : ${settings.phones.replace(/^\s*mob\s*:?\s*/i, '').replace(/\s*\/\s*/, '\n')}` : ''}
        </p>
        {settings.timings && (
          <p className="text-center leading-snug whitespace-pre-line">
            {"Timing : " + settings.timings.replace(/\s*\|\s*/, "\n")}
          </p>
        )}
        <div className="text-right leading-tight">
          <p className="report-script text-[#7b1b1b] text-[16px]">{settings.technician_name ?? ''}</p>
          <p className="text-[10px]">{settings.technician_qual ?? ''}</p>
        </div>
      </div>
      {settings.equipment_line && (
        <div className="mt-1.5 text-[9.5px] font-bold text-gray-900 text-center leading-snug">
          Equipped With {settings.equipment_line.replace(/^\s*equipped with\s*/i, '')}
        </div>
      )}
      {/* navy rule separating the letterhead from the report body (matches the printed pad) */}
      <div className="mt-1.5 border-b-[2.5px] border-[#1a3a8f]" />
    </header>
  ), [settings, labName]);

  const PatientStrip = useCallback(() => patient ? (
    <section data-name-box contentEditable={false} suppressContentEditableWarning className="relative grid grid-cols-[1fr_auto] gap-x-10 gap-y-1 border border-gray-400 mt-3 p-2.5 text-[13.5px] leading-snug">
      {/* Field labels are normal weight; the filled-in values are bold (matches the lab's paper). */}
      <p>Name : <strong>{patient.title} {patient.name}</strong></p>
      <p>Test Request ID : <strong>{patient.test_no}</strong></p>
      <p>Age/Gender : <strong>{patient.age} {patient.age_unit} / {genderText}</strong></p>
      <p>Sample Collected ON : <strong>{formatDate(patient.sample_time)}</strong></p>
      <p>Collected AT : <strong>{patient.collected_at}</strong></p>
      <p>Sample Received ON : <strong>{formatDate(patient.sample_time)}</strong></p>
      <p>Referred By : <strong>{patient.doctor_name ?? 'SELF'}</strong></p>
      <p>Report DATE : <strong>{formatDate(patient.report_time)}</strong></p>
    </section>
  ) : null, [patient, genderText]);

  const PageFooter = useCallback(({ pageIndex, total, isLast }: { pageIndex: number; total: number; isLast: boolean }) => (
    <footer contentEditable={false} suppressContentEditableWarning className="report-letterfoot relative mt-auto pt-2 border-t border-gray-400">
      {/* QR (left) + signature (right). On pre-printed paper (no-letterhead) the CSS keeps THIS row
          but hides the QR, so the technician's signature always prints. */}
      <div className="report-foot-top flex justify-between items-end">
        {qr ? <img src={qr} alt="QR" width={66} height={66} className="report-foot-qr opacity-90" /> : <span className="report-foot-qr" />}
        {showSignature && (
          <div className="text-center">
            {settings.signature_data
              ? <img src={settings.signature_data} alt="signature" style={{ height: `${sigHeightMm}mm` }} className="mx-auto object-contain" />
              : <div style={{ height: `${sigHeightMm}mm` }} className="w-32 flex items-end justify-center text-gray-300 text-[10px] italic">[ upload signature in Settings ]</div>}
            <p className="report-sign-label text-[11px] font-bold text-[#7b1b1b] underline underline-offset-2 mt-0.5">{settings.signatory_label || 'Lab Technician'}</p>
          </div>
        )}
      </div>
      {/* "End Of Report" prints on the LAST page only. */}
      {isLast && (
        <div className="text-center text-[14px] font-bold text-gray-900 mt-2 mb-1.5">{settings.end_of_report_text || '*** End Of Report ***'}</div>
      )}
      {/* Navy rule + standard footer lines repeat on EVERY page (matches the printed letterhead). */}
      <div className={cn("border-t-[2.5px] border-[#1a3a8f] pt-1.5 flex justify-between items-baseline text-[11px] font-semibold text-gray-900", !isLast && "mt-2")}>
        <span>{settings.footer_left_text || 'NOT FOR MEDICO LEGAL PURPOSE'}</span>
        <span>{settings.footer_right_text || 'ALL TEST ARE AVAILABLE HERE'}</span>
      </div>
      {settings.footer_tests_line && (
        <div className="text-center text-[9.5px] font-bold text-gray-900 mt-1 leading-snug">
          {settings.footer_tests_line}
        </div>
      )}
      {total > 1 && <div className="text-right text-[9px] text-gray-400 mt-1">Page {pageIndex + 1} of {total}</div>}
    </footer>
  ), [qr, settings, sigHeightMm, showSignature]);

  // All hooks are above this line — safe to early-return now.
  if (!patient) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  // One A4 page per test profile (panel). The letterhead + patient strip repeat on every
  // page and a signed footer closes each — the "End of report" block lands on the last page.
  const pageList = sortedPanels.length ? sortedPanels : [null];

  return (
    // Fill the workspace exactly (viewport − topbar(60px) − main's bottom padding(32px)) and
    // hide outer overflow, so the page itself never scrolls. Each column below owns its own
    // scrollbar — the preview sheets and the config sidebar scroll fully independently.
    <div className="flex gap-6 h-[calc(100vh-92px)] overflow-hidden">
      {/* ── Preview pane ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 print:hidden shrink-0">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back to Results
          </button>
          {editing ? (
            <span className="text-xs text-gray-400">Editing at 100% — zoom resumes after you save</span>
          ) : (
          <div data-tour="rp-zoom" className="flex items-center gap-2 text-gray-500">
            <button onClick={() => setZoom(z => Math.max(25, z - 10))} className="p-1.5 rounded hover:bg-gray-100" title="Zoom out (Ctrl/Cmd −)"><ZoomOut size={15} /></button>
            <span className="text-xs w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 rounded hover:bg-gray-100" title="Zoom in (Ctrl/Cmd +)"><ZoomIn size={15} /></button>
            <button onClick={() => setZoom(100)} className="px-2 py-1 rounded hover:bg-gray-100 text-[11px] font-medium" title="Reset zoom (Ctrl/Cmd 0)">Reset</button>
          </div>
          )}
        </div>

        {editing && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#eef0fe] border border-[#c7c9ff] px-3 py-1.5 text-[12.5px] text-[#4f46e5] print:hidden">
            <Pencil size={13} strokeWidth={2} />
            <span><strong>Spreadsheet editing</strong> — <strong>click</strong>/<strong>arrows</strong> to move, <strong>type</strong> or <strong>F2</strong> to edit, <strong>Tab</strong>/<strong>Enter</strong> to move on. <strong>Drag</strong> or <strong>Shift+arrows</strong> select a block; a <strong>column heading</strong> selects the column; <strong>⌘/Ctrl+A</strong> selects all. <strong>⌘/Ctrl+C/X/V</strong> copy/cut/paste, <strong>Del</strong> clears, <strong>Esc</strong> deselects. <strong>Right-click</strong> for insert/delete rows &amp; columns &amp; borders; drag a heading's right edge to resize. Toolbar styles the whole selection. Then <strong>Save</strong>.</span>
          </div>
        )}
        {editing && <RichTextToolbar />}
        <div className="overflow-auto pb-8 flex-1 min-h-0">
          {/* Zoom the WHOLE A4 sheet uniformly (CSS zoom keeps the 210mm page fixed-width so it
              never reflows) and keep it centred. `width:210mm` + mx-auto means the scaled sheet
              stays centred in the pane at any zoom — no left/right drift. Neutralised for PDF
              capture via [data-preview-zoom] in src/lib/pdf.ts. While EDITING we force 1:1 (no
              zoom) because WebKit corrupts contentEditable selection under CSS zoom. */}
          <div data-preview-zoom style={{ width: '210mm', zoom: editing ? 1 : zoom / 100 }} className="mx-auto">
            {(editing && editHtml != null) ? (
              // EDIT MODE: edit the REAL paginated report in place (looks exactly like the PDF).
              // Filled & made editable imperatively; the chrome stays contenteditable=false.
              <div
                key="edit"
                id="report-print-area"
                ref={editHostRef}
                className={cn("report-sheet report-editing relative", !printLetterhead && "no-letterhead")}
                style={{ ['--pre-top' as string]: `${preTop}mm`, ['--pre-bottom' as string]: `${preBottom}mm`, ['--sig-bottom' as string]: `${sigBottomMm}mm`, ['--sig-right' as string]: `${sigRightMm}mm`, ['--sig-clear' as string]: `${sigBottomMm + sigHeightMm + 7}mm`, outline: '2px solid #6366f1' }}
              />
            ) : reportOverride ? (
              // Saved manual edit: render the stored full paginated report HTML, but keep the
              // per-page drag-resize alive by re-attaching handles + transforms to the
              // [data-scale-frame]/[data-editable-body] markers preserved in the saved HTML.
              <EditedReportView
                key="ov"
                html={reportOverride}
                logoData={settings.logo_data}
                className={cn("report-sheet relative", !printLetterhead && "no-letterhead")}
                styleVars={{ ['--pre-top' as string]: `${preTop}mm`, ['--pre-bottom' as string]: `${preBottom}mm`, ['--sig-bottom' as string]: `${sigBottomMm}mm`, ['--sig-right' as string]: `${sigRightMm}mm`, ['--sig-clear' as string]: `${sigBottomMm + sigHeightMm + 7}mm` }}
                overrides={pageScaleOverrides}
                onChange={handlePageScaleChange}
                onReset={resetPageScale}
              />
            ) : (
            <div
              id="report-print-area"
              className={cn("report-sheet relative", !printLetterhead && "no-letterhead")}
              style={{ ['--pre-top' as string]: `${preTop}mm`, ['--pre-bottom' as string]: `${preBottom}mm`, ['--sig-bottom' as string]: `${sigBottomMm}mm`, ['--sig-right' as string]: `${sigRightMm}mm`, ['--sig-clear' as string]: `${sigBottomMm + sigHeightMm + 7}mm` }}
            >
              {compactReport ? (
                <CompactPaginatedReport
                  sortedPanels={sortedPanels}
                  deptOf={deptOf}
                  renderPanelBody={renderPanelBody}
                  comment={comment}
                  bottomGapMm={bottomGapMm}
                  contentScale={contentScale}
                  measureKey={JSON.stringify([rowPad, colWidths, colOffset, colAlign])}
                  panelLayout={panelLayout}
                  onPanelMove={movePanel}
                  onPanelScale={setPanelScale}
                  onPanelScaleReset={resetPanelScale}
                  editing={editing}
                  repeatNameBox={repeatNameBox}
                  nameBoxSkipPage={nameBoxSkipPage}
                  Watermark={Watermark}
                  Letterhead={Letterhead}
                  PatientStrip={PatientStrip}
                  PageFooter={PageFooter}
                />
              ) : pageList.map((pg, idx) => {
                // Per-page mode: one A4 sheet per panel.
                const dept = pg ? deptOf(pg.panel) : '';
                const isLast = idx === pageList.length - 1;
                return (
                  <div
                    key={pg ? pg.panel.code : 'empty'}
                    data-report-page
                    className="report-page bg-white shadow-sm relative mx-auto flex flex-col"
                    style={{
                      width: '210mm',
                      height: '297mm',
                      overflow: 'hidden',
                      padding: '12mm',
                      boxSizing: 'border-box',
                      marginBottom: isLast ? 0 : '18px',
                      fontFamily: '"Helvetica Neue", Arial, "Liberation Sans", system-ui, sans-serif',
                      color: '#111', WebkitFontSmoothing: 'antialiased',
                    }}
                  >
                    <Watermark />
                    <Letterhead />
                    <div className="report-body relative flex-1">
                      {(idx === 0 || repeatNameBox) && (idx + 1 !== nameBoxSkipPage) && <PatientStrip />}
                      <section data-editable-body suppressContentEditableWarning className="relative mt-3" style={{ zoom: contentScale }}>
                        {pg ? (
                          <div>
                            <div className="text-center font-bold text-[14.5px] tracking-wide text-black underline underline-offset-2 mb-1">{dept}</div>
                            {!sameHeading(pg.panel.report_heading, dept) && (
                              <div className="text-center font-semibold text-[14px] text-black underline underline-offset-2 mb-1.5">{pg.panel.report_heading}</div>
                            )}
                            {pg.panel.code === 'CBC' ? (
                              <>
                                <table className="w-full text-[14px] border-collapse" style={{ tableLayout: 'fixed' }}>
                                  {renderCbcHead()}
                                  <tbody>{renderCbcWithHistograms(pg.orders)}</tbody>
                                </table>
                                {renderNotes(pg.orders)}
                              </>
                            ) : (
                              <>
                                <table className="w-full table-fixed text-[14px] border-collapse">
                                  {renderHead()}
                                  <tbody>{renderRows(pg.orders)}</tbody>
                                </table>
                                {renderNotes(pg.orders)}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 py-10 text-[14px]">No results entered yet.</div>
                        )}
                        {isLast && comment && (
                          <div className="mt-3 text-[11px]"><strong>Comments :</strong> {comment}</div>
                        )}
                      </section>
                    </div>
                    <PageFooter pageIndex={idx} total={pageList.length} isLast={isLast} />
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Action panel ── */}
      <aside className="w-[252px] shrink-0 space-y-4 pt-4 pb-8 pr-1 print:hidden h-full overflow-y-auto">
        <div data-tour="rp-deliver" className="card p-4 space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3a3b45] mb-1">Deliver</p>
          {!isApproved && (
            <>
              <p className="text-[14px] text-[#92600a] bg-[#fdf0d7] rounded-lg px-3 py-2 leading-snug">
                Approve to lock the report and unlock printing &amp; sending.
              </p>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white btn-success disabled:opacity-50"
              >
                {approving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {approving ? 'Approving…' : 'Approve report'}
              </button>
              <div className="h-px bg-[#eef0f4] my-1" />
            </>
          )}
          <OutputBtn icon={Printer} label="Print" onClick={handlePrint} done={sent.print} disabled={!isApproved || editing} busy={busy === 'print'} primary />
          <OutputBtn icon={FileDown} label="Save PDF" onClick={handlePdf} done={sent.pdf} disabled={!isApproved || editing} busy={busy === 'pdf'} />
          <OutputBtn icon={FileType2} label="Export to Word (full editing)" onClick={handleDocx} done={sent.docx} disabled={!isApproved || editing} busy={busy === 'docx'} />
          <p className="text-[11px] text-[#3a3b45] leading-snug px-1">
            {printLetterhead
              ? 'Word file includes the full lab letterhead.'
              : `Word file has no header/footer — just ${preTop}mm top & ${preBottom}mm bottom gaps for your pre-printed paper. (Set this via “Print lab letterhead”.)`}
          </p>
          {reportOverride && (
            <p className="text-[11px] text-[#3a3b45] leading-snug px-1">
              Word export uses the original report data — it won't include the in-app manual edits.
            </p>
          )}
          <OutputBtn icon={MessageCircle} label="WhatsApp" onClick={handleWhatsApp} done={sent.whatsapp} disabled={!isApproved || editing || !patient?.phone} busy={busy === 'whatsapp'} green />
          <OutputBtn icon={Mail} label="Email" onClick={handleEmail} done={sent.email} disabled={!isApproved || editing || !patient?.email} busy={busy === 'email'} />
          <OutputBtn icon={Smartphone} label="SMS" onClick={handleSms} done={sent.sms} disabled={!isApproved || editing || !patient?.phone} busy={busy === 'sms'} />
          <div className="h-px bg-[#eef0f4] my-1" />
          <OutputBtn icon={Receipt} label="Bill / Receipt" onClick={() => navigate(`/bill/${pid}`)} disabled={editing} />
        </div>

        {isApproved && (
          <div className="card p-4 space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3a3b45]">Edit report</p>
            {editing ? (
              <>
                <p className="text-[14px] text-[#3a3b45] leading-snug">
                  Click into any value/text and edit it directly — the layout stays exactly as it prints.
                  Use the toolbar above for bold, font, size, colour &amp; alignment. Header, name box &amp;
                  footer are locked. Then Save.
                </p>
                <button onClick={saveEdit} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white btn-success">
                  <Save size={16} strokeWidth={1.8} /> Save edits
                </button>
                <button onClick={cancelEdit} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#3a3b45] border border-[#e6e7ee] hover:bg-[#fafafe]">
                  <X size={15} strokeWidth={1.8} /> Cancel
                </button>
              </>
            ) : (
              <>
                {reportOverride && (
                  <p className="text-[14px] text-[#92600a] bg-[#fdf0d7] rounded-lg px-3 py-2 leading-snug">
                    This report has manual edits — they're what print &amp; send.
                  </p>
                )}
                <button data-tour="rp-edit" onClick={startEdit} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "#4f46e5" }}>
                  <Pencil size={15} strokeWidth={1.8} /> Edit here (quick)
                </button>
                <p className="text-[11px] text-[#3a3b45] leading-snug px-1">
                  For full Word-style editing, use <strong>Export to Word</strong> above and edit in Microsoft Word.
                </p>
                {reportOverride && (
                  <button onClick={revertEdit} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#b91c1c] border border-[#f0d3d3] hover:bg-[#fdf6f6]">
                    <RotateCcw size={15} strokeWidth={1.8} /> Revert to original
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div data-tour="rp-layout" className="card p-4 space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3a3b45]">Layout</p>
          <Toggle label="Pack panels (multi-page)" checked={compactReport} onChange={(v) => { setCompactReport(v); localStorage.setItem('scl_compact_report', v ? '1' : '0'); }} />
          {compactReport && (
            <div className="rounded-lg bg-[#eef0f4] px-3 py-2.5 space-y-2">
              <p className="text-[10.5px] text-[#3a3b45] leading-snug">
                Panels pack onto pages without splitting a test. Use the ↑/↓ arrows or the page
                resize handles on a panel — your adjustment is <strong>saved for that test</strong>
                and re-applied to every future report until you change it.
              </p>
              <GapInput label="Bottom gap" value={bottomGapMm} onChange={(v) => { setBottomGapMm(v); localStorage.setItem('scl_bottom_gap', String(v)); }} />
              {Object.keys(panelLayout).length > 0 && (
                <button
                  type="button"
                  onClick={() => { setPanelLayout({}); localStorage.removeItem('scl_panel_layout'); }}
                  className="w-full text-[11px] font-medium text-[#b91c1c] border border-[#f0d3d3] rounded-md py-1.5 hover:bg-[#fdf6f6]"
                >
                  Reset saved page layouts ({Object.keys(panelLayout).length})
                </button>
              )}
            </div>
          )}
          {Object.keys(histoLayout).length > 0 && (
            <button
              type="button"
              onClick={resetAllHistos}
              className="w-full text-[11px] font-medium text-[#b91c1c] border border-[#f0d3d3] rounded-md py-1.5 hover:bg-[#fdf6f6]"
            >
              Reset histogram positions ({Object.keys(histoLayout).length})
            </button>
          )}
          <Toggle label="Repeat name box on every page" checked={repeatNameBox} onChange={(v) => { setRepeatNameBox(v); localStorage.setItem('scl_repeat_namebox', v ? '1' : '0'); }} />
          <label className="flex items-center justify-between text-[11.5px] text-[#3a3b45]">
            <span>Hide name box on page #</span>
            <span className="flex items-center gap-1">
              <input
                type="number" min={0} max={50} value={nameBoxSkipPage || ''}
                placeholder="—"
                onChange={(e) => { const v = Math.max(0, Math.min(50, Number(e.target.value) || 0)); setNameBoxSkipPage(v); localStorage.setItem('scl_namebox_skip', String(v)); }}
                className="w-14 rounded border border-[#d8d3cc] bg-white px-2 py-1 text-right tabular-nums"
              />
            </span>
          </label>
          <p className="text-[10.5px] text-[#3a3b45] leading-snug -mt-1">
            The name box shows on every page. Type a page number above to omit it on just that page
            (e.g. <strong>2</strong> for a long test that continues onto page 2). Page 1 still keeps
            the letterhead, footer &amp; signature throughout.
          </p>
          <Toggle label="Print lab letterhead" checked={printLetterhead} onChange={(v) => { setPrintLetterhead(v); localStorage.setItem('scl_print_letterhead', v ? '1' : '0'); }} />
          {!printLetterhead && (
            <div className="rounded-lg bg-[#eef0f4] px-3 py-2.5 space-y-2">
              <p className="text-[10.5px] text-[#3a3b45] leading-snug">
                Letterhead hidden for printing on your pre-printed paper. Adjust the gaps so the data lands inside the printed frame.
              </p>
              <GapInput label="Top gap" value={preTop} onChange={(v) => { setPreTop(v); localStorage.setItem('scl_pre_top', String(v)); }} />
              <GapInput label="Bottom gap" value={preBottom} onChange={(v) => { setPreBottom(v); localStorage.setItem('scl_pre_bottom', String(v)); }} />
            </div>
          )}
          {/* Signature: toggle on/off, then place it precisely over your pre-printed line — height,
              distance from the page bottom, and distance from the right margin (moves it left/right).
              All saved, so it stays put. */}
          <Toggle label="Signature" checked={showSignature} onChange={(v) => { setShowSignature(v); localStorage.setItem('scl_show_signature', v ? '1' : '0'); }} />
          {showSignature && <>
            <GapInput label="Signature height" value={sigHeightMm} onChange={(v) => { setSigHeightMm(v); localStorage.setItem('scl_sig_height', String(v)); }} />
            <GapInput label="Signature from bottom" value={sigBottomMm} max={120} onChange={(v) => { setSigBottomMm(v); localStorage.setItem('scl_sig_bottom', String(v)); }} />
            <GapInput label="Signature from right" value={sigRightMm} max={120} onChange={(v) => { setSigRightMm(v); localStorage.setItem('scl_sig_right', String(v)); }} />
          </>}
          <Toggle label="Watermark" checked={showWatermark} onChange={(v) => { setShowWatermark(v); localStorage.setItem('scl_watermark', v ? '1' : '0'); }} />
          {hiddenNotes.size > 0 && (
            <button onClick={restoreNotes} className="text-[11px] text-[#4f46e5] hover:underline">
              Restore {hiddenNotes.size} deleted remark{hiddenNotes.size > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {bill && (
          <div className="card p-4 space-y-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3a3b45] mb-1">Billing</p>
            <Row k="Total" v={`₹${bill.total}`} />
            {bill.concession > 0 && <Row k="Concession" v={`− ₹${bill.concession}`} />}
            {bill.concession > 0 && <Row k="Amount" v={`₹${bill.net}`} />}
          </div>
        )}
      </aside>
    </div>
  );
}

const FONT_FAMILIES = ['Helvetica Neue', 'Arial', 'Times New Roman', 'Georgia', 'Calibri', 'Courier New', 'Verdana', 'Tahoma'];
const FONT_SIZES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const editorHost = () => document.getElementById('report-print-area');

/** Word/Excel-style rich-text toolbar — built WITHOUT document.execCommand (which is a
 *  no-op in some WebViews). Every action manipulates the DOM directly through the standard
 *  Selection/Range API: character formatting wraps the selected text in a styled <span>,
 *  block formatting sets styles on the enclosing cell/paragraph, and undo/redo restore
 *  innerHTML snapshots. This works in every engine because it's plain DOM manipulation. */
function RichTextToolbar() {
  const savedRange = useRef<Range | null>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  // ── Spreadsheet-style cell selection ─────────────────────────────────────────────
  // `selectedCells` holds whole <td>/<th> elements that are block-selected. When that set is
  // non-empty AND there is no character-level text selection, the toolbar's format buttons act
  // on the whole cells (cell-level styling) — so you can select a column / row / range / single
  // cell and bold, recolour or resize all of it at once. The gestures (below) are:
  //   • click a cell           → select just that cell (and place the caret so you can type)
  //   • drag across cells      → select a rectangular block (covers rows & columns too)
  //   • click a column heading → select the whole column
  //   • Shift+click            → extend the selection from the anchor to the clicked cell
  //   • Cmd/Ctrl+click         → add/remove a single cell from the selection
  const selectedCells = useRef<HTMLElement[]>([]);
  const anchorCell = useRef<HTMLElement | null>(null);
  // The cell currently in text-edit mode (made contentEditable on double-click / typing).
  const editingCell = useRef<HTMLElement | null>(null);
  // The focused ("active") cell — the moving end for keyboard navigation & range extension.
  const activeCell = useRef<HTMLElement | null>(null);
  // Internal cell clipboard (2D innerHTML grid) for copy/cut/paste.
  const clipboard = useRef<string[][] | null>(null);
  const clearCellSel = () => {
    selectedCells.current.forEach(c => c.classList.remove('report-cell-selected'));
    selectedCells.current = [];
  };
  const setCellSel = (cells: HTMLElement[]) => {
    clearCellSel();
    cells.forEach(c => c.classList.add('report-cell-selected'));
    selectedCells.current = cells;
  };
  /** Finish editing the active cell: lock it back to a non-editable grid cell. */
  const commitEdit = () => {
    const cell = editingCell.current;
    if (!cell) return;
    cell.contentEditable = 'false';
    cell.classList.remove('report-cell-editing');
    editingCell.current = null;
  };
  /** Enter text-edit mode for a cell. `selectAll` highlights its text (typing replaces it). */
  const enterEdit = (cell: HTMLElement, selectAll: boolean) => {
    if (editingCell.current && editingCell.current !== cell) commitEdit();
    setCellSel([cell]);
    anchorCell.current = cell;
    editingCell.current = cell;
    cell.contentEditable = 'true';
    cell.classList.add('report-cell-editing');
    cell.focus({ preventScroll: true });
    const r = document.createRange();
    r.selectNodeContents(cell);
    if (!selectAll) r.collapse(false);   // caret at end
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    savedRange.current = r.cloneRange();
  };
  /** All cells in `th`'s column (same table, same cellIndex). */
  const columnCells = (th: HTMLTableCellElement): HTMLElement[] => {
    const table = th.closest('table'); if (!table) return [th];
    const idx = th.cellIndex; const out: HTMLElement[] = [];
    table.querySelectorAll('tr').forEach(tr => { const c = (tr as HTMLTableRowElement).cells[idx]; if (c) out.push(c as HTMLElement); });
    return out;
  };
  /** Every cell in the rectangle spanned by cells `a` and `b` (same table). */
  const rangeCells = (a: HTMLElement, b: HTMLElement): HTMLElement[] => {
    const table = a.closest('table');
    if (!table || b.closest('table') !== table) return [b];
    const rows = Array.from((table as HTMLTableElement).rows);
    const ra = rows.indexOf((a.closest('tr') as HTMLTableRowElement));
    const rb = rows.indexOf((b.closest('tr') as HTMLTableRowElement));
    const ca = (a as HTMLTableCellElement).cellIndex, cb = (b as HTMLTableCellElement).cellIndex;
    const [rlo, rhi] = [Math.min(ra, rb), Math.max(ra, rb)];
    const [clo, chi] = [Math.min(ca, cb), Math.max(ca, cb)];
    const out: HTMLElement[] = [];
    for (let r = rlo; r <= rhi; r++) {
      const row = rows[r]; if (!row) continue;
      for (let c = clo; c <= chi; c++) { const cell = row.cells[c]; if (cell) out.push(cell as HTMLElement); }
    }
    return out;
  };
  /** True when the user has highlighted characters inside the editor (so formatting should
   *  target that text rather than the whole selected cells). */
  const hasTextSel = (): boolean => {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0) return false;
    const r = s.getRangeAt(0);
    return !r.collapsed && !!editorHost()?.contains(r.commonAncestorContainer);
  };
  /** If a cell selection is active (and no text is highlighted), run `fn` on every selected
   *  cell with one undo checkpoint and return true; else return false so the caller falls back
   *  to text-range formatting. */
  const applyToCells = (fn: (el: HTMLElement) => void): boolean => {
    if (hasTextSel() || !selectedCells.current.length) return false;
    pushUndo();
    selectedCells.current.forEach(fn);
    return true;
  };

  // ── Structural table operations (act on the current cell selection) ───────────────
  const tableOf = (): HTMLTableElement | null => (selectedCells.current[0]?.closest('table') as HTMLTableElement) ?? null;
  const distinctRows = (): HTMLTableRowElement[] => {
    const set = new Set<HTMLTableRowElement>();
    selectedCells.current.forEach(c => { const tr = c.closest('tr'); if (tr) set.add(tr as HTMLTableRowElement); });
    const table = tableOf();
    if (!table) return [...set];
    // Return in document order.
    return Array.from(table.rows).filter(r => set.has(r));
  };
  const distinctCols = (): number[] => {
    const set = new Set<number>();
    selectedCells.current.forEach(c => set.add((c as HTMLTableCellElement).cellIndex));
    return [...set].sort((a, b) => a - b);
  };
  const deleteRows = () => {
    if (!selectedCells.current.length) return;
    pushUndo();
    distinctRows().forEach(tr => tr.remove());
    clearCellSel(); anchorCell.current = null;
  };
  const deleteCols = () => {
    const table = tableOf(); if (!table) return;
    pushUndo();
    const cg = table.querySelector('colgroup');
    // Remove from the highest index first so earlier indices stay valid.
    distinctCols().sort((a, b) => b - a).forEach(idx => {
      Array.from(table.rows).forEach(r => { const cell = r.cells[idx]; if (cell) cell.remove(); });
      if (cg && cg.children[idx]) cg.children[idx].remove();
    });
    clearCellSel(); anchorCell.current = null;
  };
  const clearContents = () => {
    if (!selectedCells.current.length) return;
    pushUndo();
    selectedCells.current.forEach(c => { c.innerHTML = '<br>'; });
  };
  const insertRow = (below: boolean) => {
    const rows = distinctRows(); if (!rows.length) return;
    pushUndo();
    const ref = below ? rows[rows.length - 1] : rows[0];
    const clone = ref.cloneNode(true) as HTMLTableRowElement;
    Array.from(clone.cells).forEach(c => { c.innerHTML = '<br>'; c.classList.remove('report-cell-selected'); });
    if (below) ref.after(clone); else ref.before(clone);
  };
  const insertCol = (right: boolean) => {
    const table = tableOf(); if (!table) return;
    const cols = distinctCols(); if (!cols.length) return;
    pushUndo();
    const idx = right ? cols[cols.length - 1] : cols[0];
    Array.from(table.rows).forEach(r => {
      const refCell = r.cells[idx];
      const tag = refCell?.tagName.toLowerCase() === 'th' ? 'th' : 'td';
      const nc = document.createElement(tag);
      nc.innerHTML = '<br>';
      if (refCell) { if (right) refCell.after(nc); else refCell.before(nc); } else r.appendChild(nc);
    });
    const cg = table.querySelector('colgroup');
    if (cg) {
      const refCol = cg.children[idx];
      const nc = document.createElement('col');
      if (refCol) { if (right) refCol.after(nc); else refCol.before(nc); } else cg.appendChild(nc);
    }
    clearCellSel(); anchorCell.current = null;
  };
  /** Number / bullet each selected cell in order (toggles off if markers already present). */
  const listCells = (ordered: boolean) => {
    pushUndo();
    let n = 0;
    selectedCells.current.forEach(c => {
      const existing = c.querySelector(':scope > [data-list-marker]');
      if (existing) { existing.remove(); return; }
      n += 1;
      const marker = document.createElement('span');
      marker.setAttribute('data-list-marker', '');
      marker.style.marginRight = '6px';
      marker.textContent = ordered ? `${n}.` : '•';
      c.insertBefore(marker, c.firstChild);
    });
  };

  // ── Keyboard navigation ───────────────────────────────────────────────────────
  /** Move the active cell by (dr, dc). `extend` grows the selection from the anchor (Shift). */
  const moveActive = (dr: number, dc: number, extend: boolean) => {
    const active = activeCell.current ?? selectedCells.current[selectedCells.current.length - 1];
    if (!active) return;
    const table = active.closest('table'); if (!table) return;
    const rows = Array.from((table as HTMLTableElement).rows);
    const r = rows.indexOf(active.closest('tr') as HTMLTableRowElement);
    const c = (active as HTMLTableCellElement).cellIndex;
    if (r < 0) return;
    const nr = Math.max(0, Math.min(rows.length - 1, r + dr));
    const row = rows[nr]; if (!row || !row.cells.length) return;
    const nc = Math.max(0, Math.min(row.cells.length - 1, c + dc));
    const next = row.cells[nc] as HTMLElement; if (!next) return;
    activeCell.current = next;
    if (extend && anchorCell.current) setCellSel(rangeCells(anchorCell.current, next));
    else { anchorCell.current = next; setCellSel([next]); }
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const selectAllInTable = () => {
    const active = activeCell.current ?? selectedCells.current[0];
    const table = active?.closest('table'); if (!table) return;
    setCellSel(Array.from(table.querySelectorAll<HTMLElement>('td,th')));
    anchorCell.current = (table.querySelector('td,th') as HTMLElement) ?? null;
  };

  // ── Clipboard (copy / cut / paste cell blocks) ────────────────────────────────
  const htmlToText = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent ?? ''; };
  /** The selection as a rectangular 2D grid of cell innerHTML (fills gaps from the table). */
  const selectionGrid = (): { grid: string[][] } | null => {
    const cells = selectedCells.current; if (!cells.length) return null;
    const table = cells[0].closest('table') as HTMLTableElement | null; if (!table) return null;
    const rows = Array.from(table.rows);
    let rmin = Infinity, rmax = -1, cmin = Infinity, cmax = -1;
    const pos = new Map<string, HTMLElement>();
    cells.forEach(cell => {
      const r = rows.indexOf(cell.closest('tr') as HTMLTableRowElement);
      const c = (cell as HTMLTableCellElement).cellIndex;
      if (r < 0) return;
      pos.set(`${r}_${c}`, cell);
      rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); cmin = Math.min(cmin, c); cmax = Math.max(cmax, c);
    });
    if (rmax < 0) return null;
    const grid: string[][] = [];
    for (let r = rmin; r <= rmax; r++) {
      const rowArr: string[] = [];
      for (let c = cmin; c <= cmax; c++) {
        const cell = pos.get(`${r}_${c}`) ?? (rows[r]?.cells[c] as HTMLElement | undefined);
        rowArr.push(cell ? cell.innerHTML : '');
      }
      grid.push(rowArr);
    }
    return { grid };
  };
  const copySel = () => {
    const g = selectionGrid(); if (!g) return;
    clipboard.current = g.grid;
    try { navigator.clipboard?.writeText(g.grid.map(r => r.map(htmlToText).join('\t')).join('\n')); } catch { /* clipboard blocked — internal paste still works */ }
  };
  const cutSel = () => { copySel(); pushUndo(); selectedCells.current.forEach(c => { c.innerHTML = '<br>'; }); };
  const pasteSel = () => {
    const cb = clipboard.current; if (!cb) return;
    pushUndo();
    // A single copied cell pasted onto a multi-cell selection fills them all (Excel behaviour).
    if (cb.length === 1 && cb[0].length === 1 && selectedCells.current.length > 1) {
      const val = cb[0][0];
      selectedCells.current.forEach(c => { c.innerHTML = val; });
      return;
    }
    const active = activeCell.current ?? selectedCells.current[0]; if (!active) return;
    const table = active.closest('table') as HTMLTableElement | null; if (!table) return;
    const rows = Array.from(table.rows);
    const r0 = rows.indexOf(active.closest('tr') as HTMLTableRowElement);
    const c0 = (active as HTMLTableCellElement).cellIndex;
    const pasted: HTMLElement[] = [];
    for (let i = 0; i < cb.length; i++) {
      const row = rows[r0 + i]; if (!row) break;
      for (let j = 0; j < cb[i].length; j++) {
        const cell = row.cells[c0 + j] as HTMLElement | undefined;
        if (cell) { cell.innerHTML = cb[i][j]; pasted.push(cell); }
      }
    }
    if (pasted.length) setCellSel(pasted);
  };

  // ── Cell-level formatting (borders, vertical alignment) ───────────────────────
  const forEachSelCell = (fn: (el: HTMLElement) => void) => {
    if (!selectedCells.current.length) return;
    pushUndo();
    selectedCells.current.forEach(fn);
  };
  const toggleBorders = () => forEachSelCell(c => {
    const on = !!c.style.border && c.style.border !== 'none' && c.style.border !== '';
    c.style.border = on ? 'none' : '1px solid #111';
  });
  const vAlign = (v: string) => forEachSelCell(c => { c.style.verticalAlign = v; });

  // Right-click context menu (table operations). Positioned at the cursor.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Wire the gestures. Lives only while the toolbar (edit mode) is mounted. Delegation on the
  // host means it keeps working after the editable HTML is (re)written.
  useEffect(() => {
    const host = editorHost();
    if (!host) return;
    let downCell: HTMLElement | null = null;
    let dragging = false;
    let lastDragCell: HTMLElement | null = null;   // last cell the drag extended to (smoothness)
    // Column resize state.
    let resizeTh: HTMLTableCellElement | null = null;
    let resizeStartX = 0, resizeStartW = 0;
    let rafPending = false;   // coalesce resize updates to one per frame

    const cellOf = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const c = el?.closest('td,th') as HTMLElement | null;
      return c && host.contains(c) ? c : null;
    };
    const setColWidth = (th: HTMLTableCellElement, w: number) => {
      const table = th.closest('table'); if (!table) return;
      const idx = th.cellIndex;
      const cg = table.querySelector('colgroup');
      if (cg && cg.children[idx]) (cg.children[idx] as HTMLElement).style.width = `${w}px`;
      else th.style.width = `${w}px`;
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setMenu(null);
      const cell = cellOf(e.target);
      // Clicking inside the cell that's already being edited → let the browser place the caret.
      if (cell && cell === editingCell.current) return;
      // Clicking anywhere else commits an in-progress cell edit.
      if (editingCell.current) commitEdit();

      // Column resize: grab the right edge (~7px) of a column heading.
      const th = (e.target as HTMLElement | null)?.closest('thead th') as HTMLTableCellElement | null;
      if (th && host.contains(th)) {
        const rect = th.getBoundingClientRect();
        if (rect.right - e.clientX <= 7) {
          e.preventDefault();
          resizeTh = th; resizeStartX = e.clientX; resizeStartW = rect.width;
          host.classList.add('is-col-resizing');
          return;
        }
      }
      // Clicked a non-cell area (heading/notes/blank) → clear the grid selection and let the
      // editable text region take the caret.
      if (!cell) { clearCellSel(); anchorCell.current = null; return; }

      // Cells are non-editable grid cells: WE own the pointer (no browser text-selection here),
      // which is exactly why selection & deselection feel clean.
      e.preventDefault();
      if (e.shiftKey && anchorCell.current) { activeCell.current = cell; setCellSel(rangeCells(anchorCell.current, cell)); return; }
      if (e.metaKey || e.ctrlKey) {
        const set = new Set(selectedCells.current);
        if (set.has(cell)) { cell.classList.remove('report-cell-selected'); set.delete(cell); }
        else { cell.classList.add('report-cell-selected'); set.add(cell); }
        selectedCells.current = [...set];
        anchorCell.current = cell; activeCell.current = cell;
        return;
      }
      // Header → select whole column; body cell → select just it. Drag extends either.
      if (cell.closest('thead')) { setCellSel(columnCells(cell as HTMLTableCellElement)); }
      else setCellSel([cell]);
      anchorCell.current = cell; activeCell.current = cell;
      downCell = cell; dragging = false; lastDragCell = cell;
    };

    const onMove = (e: MouseEvent) => {
      if (resizeTh) {
        e.preventDefault();
        const x = e.clientX;
        if (rafPending) return;            // one width update per animation frame = buttery resize
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (resizeTh) setColWidth(resizeTh, Math.max(30, resizeStartW + (x - resizeStartX)));
        });
        return;
      }
      // Show a col-resize cursor when hovering a heading's right edge.
      if (!downCell && (e.buttons & 1) === 0) {
        const th = (e.target as HTMLElement | null)?.closest('thead th') as HTMLTableCellElement | null;
        if (th && host.contains(th)) {
          const r = th.getBoundingClientRect();
          th.style.cursor = r.right - e.clientX <= 7 ? 'col-resize' : 'cell';
        }
        return;
      }
      if (!downCell || (e.buttons & 1) === 0) return;
      const cell = cellOf(e.target);
      if (!cell || cell === lastDragCell) return;   // only recompute when the hovered cell changes
      lastDragCell = cell;
      dragging = true;
      host.classList.add('is-cell-dragging');
      e.preventDefault();
      activeCell.current = cell;
      setCellSel(rangeCells(downCell, cell));   // covers dragging back to the origin (collapses)
    };

    const onUp = () => {
      lastDragCell = null;
      host.classList.remove('is-cell-dragging');
      if (resizeTh) { resizeTh = null; host.classList.remove('is-col-resizing'); }
      downCell = null; dragging = false;
    };

    // Double-click a cell → edit its text (caret at the end).
    const onDbl = (e: MouseEvent) => {
      const cell = cellOf(e.target);
      if (cell) { e.preventDefault(); enterEdit(cell, false); }
    };

    // Right-click a cell → table-operations menu. If the cell isn't already selected, select it.
    const onCtx = (e: MouseEvent) => {
      const cell = cellOf(e.target);
      if (!cell) return;
      e.preventDefault();
      if (editingCell.current) commitEdit();
      if (!selectedCells.current.includes(cell)) { setCellSel([cell]); anchorCell.current = cell; }
      setMenu({ x: e.clientX, y: e.clientY });
    };

    // Full spreadsheet keyboard model.
    const ARROWS: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    const onKey = (e: KeyboardEvent) => {
      const host2 = editorHost();
      if (!host2) return;
      // Only act when our editor is focused or cells are selected.
      if (!host2.contains(document.activeElement) && !selectedCells.current.length && !editingCell.current) return;

      if (e.key === 'Escape') {
        if (editingCell.current) commitEdit();
        else { clearCellSel(); anchorCell.current = null; activeCell.current = null; }
        return;
      }
      // While editing a cell: Tab / Enter commit and move (Excel); everything else types normally.
      if (editingCell.current) {
        if (e.key === 'Tab') { e.preventDefault(); commitEdit(); moveActive(0, e.shiftKey ? -1 : 1, false); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); moveActive(1, 0, false); }
        return;
      }
      const sel = selectedCells.current;
      if (!sel.length) return;

      // Clipboard / select-all (Ctrl/Cmd). Other Ctrl combos (B/I/U/Z/Y) handled elsewhere.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'c') { e.preventDefault(); copySel(); return; }
        if (k === 'x') { e.preventDefault(); cutSel(); return; }
        if (k === 'v') { e.preventDefault(); pasteSel(); return; }
        if (k === 'a') { e.preventDefault(); selectAllInTable(); return; }
        return;
      }
      // Navigation.
      if (e.key in ARROWS) { e.preventDefault(); const [dr, dc] = ARROWS[e.key]; moveActive(dr, dc, e.shiftKey); return; }
      if (e.key === 'Tab') { e.preventDefault(); moveActive(0, e.shiftKey ? -1 : 1, false); return; }
      if (e.key === 'Enter') { e.preventDefault(); moveActive(e.shiftKey ? -1 : 1, 0, false); return; }
      if (e.key === 'F2') { e.preventDefault(); enterEdit(activeCell.current ?? sel[0], false); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); pushUndo();
        sel.forEach(c => { c.innerHTML = '<br>'; });
        return;
      }
      // A printable key on a single selected cell → start editing, replacing its content (Excel).
      if (sel.length === 1 && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        pushUndo();
        sel[0].innerHTML = '';
        enterEdit(sel[0], false);   // the keypress itself then inserts the character
      }
    };
    document.addEventListener('keydown', onKey);

    host.addEventListener('mousedown', onDown);
    host.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    host.addEventListener('dblclick', onDbl);
    host.addEventListener('contextmenu', onCtx);
    return () => {
      host.removeEventListener('mousedown', onDown);
      host.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      host.removeEventListener('dblclick', onDbl);
      host.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('keydown', onKey);
      commitEdit();
      clearCellSel();
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Continuously remember the last selection that was inside the editable host, so a command
  // still has a target even after a dropdown/colour-picker briefly stole focus.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const host = editorHost();
      if (!sel || sel.rangeCount === 0 || !host) return;
      const range = sel.getRangeAt(0);
      if (host.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  /** Re-focus the editor and return a usable Range to operate on. Prefers the live selection;
   *  falls back to the last one that was inside the editor (survives a <select>/colour-picker
   *  stealing focus). When `expand` is set and the selection is just a caret, it grows to the
   *  enclosing cell/line — so "click a cell, press Bold" styles the whole cell with no drag
   *  (Excel/Word behaviour). The returned range is also made the LIVE selection, so the result
   *  is visible and the user can chain more formats. */
  const getRange = (expand: boolean): Range | null => {
    const host = editorHost();
    if (!host) return null;
    // Focus the active editable region (the cell being edited, else an editable body section) —
    // NOT the host, which is non-editable in the grid model and focusing it would drop the caret.
    (editingCell.current ?? host.querySelector<HTMLElement>('[data-editable-body]') ?? host).focus({ preventScroll: true });
    const sel = window.getSelection();
    if (!sel) return null;
    let range: Range | null = null;
    if (sel.rangeCount && host.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0).cloneRange();
    } else if (savedRange.current && host.contains(savedRange.current.commonAncestorContainer)) {
      range = savedRange.current.cloneRange();
    }
    if (!range) return null;
    if (expand && range.collapsed) {
      let node: Node | null = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const block = (node as Element | null)?.closest('td,th,li,p,div');
      if (!block || !host.contains(block) || block === host) return null;
      const r = document.createRange();
      r.selectNodeContents(block);
      range = r;
    }
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange.current = range.cloneRange();
    return range;
  };

  const pushUndo = () => {
    const host = editorHost();
    if (host) { undoStack.current.push(host.innerHTML); redoStack.current = []; }
  };

  const reselect = (node: Node) => {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(node);
    sel?.removeAllRanges();
    sel?.addRange(r);
    savedRange.current = r.cloneRange();
  };

  /** Wrap the current selection in a <span> styled by `apply`. The core of all character
   *  formatting — pure DOM (works in every WebView; execCommand is unreliable here). */
  const wrapInline = (apply: (s: HTMLElement) => void) => {
    const range = getRange(true);
    if (!range || range.collapsed) return;
    pushUndo();
    const span = document.createElement('span');
    apply(span);
    try {
      range.surroundContents(span);
    } catch {
      // Selection crosses element boundaries — extract, wrap, re-insert.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    reselect(span);   // re-select wrapped content so formats chain
  };

  /** Read a computed style on the actual content being formatted (used to TOGGLE bold/italic).
   *  Descends into the first real child when the range starts on a cell/element so toggling
   *  an already-formatted cell correctly turns the format OFF. */
  const styleAt = (prop: string): string => {
    const range = savedRange.current ?? (window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null);
    if (!range) return '';
    let node: Node | null = range.startContainer;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      node = el.childNodes[range.startOffset] ?? el.firstChild ?? el;
    }
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    return node && node instanceof Element ? getComputedStyle(node as Element).getPropertyValue(prop) : '';
  };

  /** Set a CSS property on EVERY block the selection touches (alignment, indent) — so aligning
   *  a multi-row selection aligns all of its rows, not just the common ancestor. */
  const styleBlock = (apply: (el: HTMLElement) => void) => {
    const range = getRange(false);
    if (!range) return;
    pushUndo();
    const host = editorHost();
    const blocks = new Set<HTMLElement>();
    const add = (n: Node | null) => {
      if (n && n.nodeType === Node.TEXT_NODE) n = n.parentElement;
      const b = (n as Element | null)?.closest('td,th,p,div,li,section') as HTMLElement | null;
      if (b && host?.contains(b) && b !== host) blocks.add(b);
    };
    if (!range.collapsed) {
      // Walk all block elements intersecting the selection.
      const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (el) => range.intersectsNode(el) && (el as Element).matches('td,th,p,div,li,section')
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
      });
      let cur = walker.nextNode();
      while (cur) { add(cur); cur = walker.nextNode(); }
    }
    add(range.startContainer);
    add(range.endContainer);
    if (!blocks.size) add(range.commonAncestorContainer);
    blocks.forEach(apply);
  };

  /** Native browser editing command — used for the formats that must TOGGLE cleanly (underline,
   *  strike, lists). CSS text-decoration can't be removed by a nested span, and the browser's
   *  execCommand correctly splits/unwraps elements to turn a format off (exactly like Word).
   *  Falls back to `fallback` if the command is a no-op in this WebView. */
  const execCmd = (cmd: string, fallback?: () => void) => {
    const range = getRange(true);
    if (!range) return;
    const host = editorHost();
    const before = host?.innerHTML;
    pushUndo();
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* ignore */ }
    let ok = false;
    try { ok = document.execCommand(cmd); } catch { ok = false; }
    // Some WebViews report success but make no change (or aren't supported at all). If the DOM
    // didn't actually change, run the pure-DOM fallback so the button never feels dead.
    if ((!ok || host?.innerHTML === before) && fallback) { fallback(); return; }
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  // Pure-DOM apply of a text-decoration (fallback when execCommand can't toggle here).
  const wrapDeco = (kind: string) => {
    const range = getRange(true);
    if (!range || range.collapsed) return;
    const span = document.createElement('span');
    span.style.textDecoration = kind;
    try { range.surroundContents(span); }
    catch { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); }
    reselect(span);
  };

  // Each format first tries the column/cell selection (Excel-style: style the whole cells);
  // if none is active it falls back to text-range formatting.
  const bold        = () => { if (applyToCells(c => { c.style.fontWeight = /^(bold|[6-9]00)/.test(getComputedStyle(c).fontWeight) ? 'normal' : 'bold'; })) return; wrapInline(s => s.style.fontWeight = /^(bold|[6-9]00)/.test(styleAt('font-weight')) ? 'normal' : 'bold'); };
  const italic      = () => { if (applyToCells(c => { c.style.fontStyle = getComputedStyle(c).fontStyle === 'italic' ? 'normal' : 'italic'; })) return; wrapInline(s => s.style.fontStyle = styleAt('font-style') === 'italic' ? 'normal' : 'italic'); };
  // Underline & strike TOGGLE via the native engine (it splits/unwraps elements correctly — a
  // nested text-decoration span can't undo a decoration drawn by an ancestor). Pure-DOM apply
  // is the fallback if execCommand is a no-op in this WebView.
  const underline   = () => { if (applyToCells(c => { c.style.textDecoration = c.style.textDecoration.includes('underline') ? 'none' : 'underline'; })) return; execCmd('underline', () => wrapDeco('underline')); };
  const strike      = () => { if (applyToCells(c => { c.style.textDecoration = c.style.textDecoration.includes('line-through') ? 'none' : 'line-through'; })) return; execCmd('strikeThrough', () => wrapDeco('line-through')); };
  const fontFamily  = (f: string) => { if (applyToCells(c => { c.style.fontFamily = f; })) return; wrapInline(s => s.style.fontFamily = f); };
  const fontSize    = (px: string) => { if (applyToCells(c => { c.style.fontSize = `${px}px`; })) return; wrapInline(s => s.style.fontSize = `${px}px`); };
  const foreColor   = (c: string) => { if (applyToCells(cell => { cell.style.color = c; })) return; wrapInline(s => s.style.color = c); };
  const highlight   = (c: string) => { if (applyToCells(cell => { cell.style.backgroundColor = c; })) return; wrapInline(s => s.style.backgroundColor = c); };
  const align       = (v: string) => { if (applyToCells(c => { c.style.textAlign = v; })) return; styleBlock(el => el.style.textAlign = v); };
  /** Shift a block left/right. Table cells IGNORE margin, so for a <td>/<th> we shift an inner
   *  wrapper div instead. No lower clamp — negative margins let content slide all the way to the
   *  far left (and positive all the way right), so the user can position it anywhere on the page. */
  const indent = (delta: number) => styleBlock(el => {
    let target = el;
    if (el.tagName === 'TD' || el.tagName === 'TH') {
      let wrap = el.querySelector<HTMLElement>(':scope > [data-indent-wrap]');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.setAttribute('data-indent-wrap', '');
        while (el.firstChild) wrap.appendChild(el.firstChild);
        el.appendChild(wrap);
      }
      target = wrap;
    }
    const cur = parseFloat(target.style.marginLeft || '0') || 0;
    target.style.marginLeft = `${cur + delta}px`;
  });

  /** Toggle the selection in/out of a bullet/numbered list (Word-style: click once → markers
   *  appear; click again → markers removed). Pure DOM with the marker styles FORCED inline,
   *  because Tailwind's reset strips list markers/padding from every <ul>/<ol> — which is why
   *  lists looked like they "did nothing". Works inside table cells, notes and paragraphs. */
  const makeList = (ordered: boolean) => {
    // Multiple cells selected → number/bullet each selected cell in order (e.g. number the rows).
    if (!hasTextSel() && selectedCells.current.length > 1) { listCells(ordered); return; }
    const range = getRange(true);
    if (!range) return;
    const host = editorHost();
    if (!host) return;
    pushUndo();
    // Already inside a list? → toggle OFF: unwrap each <li> back to a <div> line.
    let n: Node | null = range.startContainer;
    if (n.nodeType === Node.TEXT_NODE) n = n.parentElement;
    const existing = (n as Element | null)?.closest('ul,ol') as HTMLElement | null;
    if (existing && host.contains(existing) && existing !== host) {
      const parent = existing.parentNode!;
      const frag = document.createDocumentFragment();
      existing.querySelectorAll(':scope > li').forEach(li => {
        li.querySelectorAll('[data-list-marker]').forEach(m => m.remove());   // drop the • / 1. text
        const div = document.createElement('div');
        while (li.firstChild) div.appendChild(li.firstChild);
        if (!div.childNodes.length) div.appendChild(document.createElement('br'));
        frag.appendChild(div);
      });
      const first = frag.firstChild;
      parent.replaceChild(frag, existing);
      if (first) reselect(first);
      return;
    }
    // Otherwise wrap. The marker (• or 1. 2. 3.) is a real TEXT node, not a CSS list-style —
    // because (a) Tailwind's reset hides CSS markers and (b) html2canvas (PDF/print) doesn't
    // render CSS markers reliably. As text it shows identically on screen, in PDF and in Word.
    const list = document.createElement(ordered ? 'ol' : 'ul');
    list.style.cssText = 'margin:2px 0;padding-left:6px;list-style:none';
    let counter = 0;
    const mkLi = () => {
      counter += 1;
      const li = document.createElement('li');
      li.style.cssText = 'display:block;list-style:none';
      const marker = document.createElement('span');
      marker.setAttribute('data-list-marker', '');
      marker.style.marginRight = '6px';
      marker.textContent = ordered ? counter + '.' : '•';
      li.appendChild(marker);
      return li;
    };
    // Prefer converting the whole enclosing line/block; split multi-line blocks on <br> so each
    // line becomes its own bullet/number.
    let bn: Node | null = range.startContainer;
    if (bn.nodeType === Node.TEXT_NODE) bn = bn.parentElement;
    const block = (bn as Element | null)?.closest('td,th,li,p,div,section') as HTMLElement | null;
    if (block && block !== host) {
      const lines = block.innerHTML.split(/<br\s*\/?>/i);
      for (const line of lines) { const li = mkLi(); const span = document.createElement('span'); span.innerHTML = line.trim() || '&nbsp;'; li.appendChild(span); list.appendChild(li); }
      block.innerHTML = '';
      block.appendChild(list);
    } else {
      const li = mkLi();
      const wrap = document.createElement('span');
      try { wrap.appendChild(range.extractContents()); } catch { wrap.textContent = range.toString(); }
      if (!wrap.childNodes.length) wrap.innerHTML = '&nbsp;';
      li.appendChild(wrap);
      list.appendChild(li);
      range.insertNode(list);
    }
    reselect(list);
  };

  const clearFormat = () => {
    const range = getRange(true);
    if (!range || range.collapsed) return;
    pushUndo();
    const text = range.toString();
    range.deleteContents();
    const tn = document.createTextNode(text);
    range.insertNode(tn);
    reselect(tn);
  };

  // After an innerHTML swap every node is detached, so the saved range must be discarded or
  // the next command would act on stale/detached nodes (corruption).
  const undo = () => { const h = editorHost(); if (h && undoStack.current.length) { clearCellSel(); redoStack.current.push(h.innerHTML); h.innerHTML = undoStack.current.pop()!; savedRange.current = null; } };
  const redo = () => { const h = editorHost(); if (h && redoStack.current.length) { clearCellSel(); undoStack.current.push(h.innerHTML); h.innerHTML = redoStack.current.pop()!; savedRange.current = null; } };

  // Keyboard shortcuts inside the editor: Ctrl/Cmd + B / I / U (Word-style). (Ctrl/Cmd+A select-all
  // is left to the browser — it works natively now that the editor is zoom-free.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const host = editorHost();
      // Fire when focus is inside the editor OR when grid cells are selected (cells aren't
      // focusable until edited, so the activeElement check alone would miss them).
      if (!host || (!host.contains(document.activeElement) && !selectedCells.current.length)) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); bold(); }
      else if (k === 'i') { e.preventDefault(); italic(); }
      else if (k === 'u') { e.preventDefault(); underline(); }
      else if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const keep = (e: React.MouseEvent) => e.preventDefault();
  const Sep = () => <span className="mx-1 h-5 w-px bg-[#e6e7ee]" />;
  const Btn = ({ onAction, title, children }: { onAction: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onAction(); }}
      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#34353f] hover:bg-[#eef0fe] hover:text-[#4f46e5] transition-colors select-none"
    >
      {children}
    </button>
  );

  return (
    <div
      onMouseDown={keep}
      className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-0.5 rounded-xl border border-[#e6e7ee] bg-white px-2 py-1.5 shadow-sm print:hidden"
    >
      <Btn title="Undo" onAction={undo}><Undo size={15} /></Btn>
      <Btn title="Redo" onAction={redo}><Redo size={15} /></Btn>
      <Sep />

      <select
        title="Font family" defaultValue="" onMouseDown={e => e.stopPropagation()}
        onChange={e => { fontFamily(e.target.value); e.currentTarget.value = ''; }}
        className="h-7 rounded-md border border-[#e6e7ee] bg-white px-1.5 text-[12px] text-[#34353f] hover:border-[#c7c9ff] focus:outline-none cursor-pointer"
      >
        <option value="" disabled>Font</option>
        {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>
      <select
        title="Font size" defaultValue="" onMouseDown={e => e.stopPropagation()}
        onChange={e => { fontSize(e.target.value); e.currentTarget.value = ''; }}
        className="h-7 w-14 rounded-md border border-[#e6e7ee] bg-white px-1 text-[12px] text-[#34353f] hover:border-[#c7c9ff] focus:outline-none cursor-pointer"
      >
        <option value="" disabled>Size</option>
        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <Sep />

      <Btn title="Bold"          onAction={bold}><Bold size={15} /></Btn>
      <Btn title="Italic"        onAction={italic}><Italic size={15} /></Btn>
      <Btn title="Underline"     onAction={underline}><Underline size={15} /></Btn>
      <Btn title="Strikethrough" onAction={strike}><Strikethrough size={15} /></Btn>
      <Sep />

      <label title="Text colour" onMouseDown={keep}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-[#eef0fe] cursor-pointer relative select-none">
        <Baseline size={15} />
        <input type="color" defaultValue="#b91c1c" onMouseDown={e => e.stopPropagation()}
          onInput={e => foreColor((e.target as HTMLInputElement).value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
      </label>
      <label title="Highlight" onMouseDown={keep}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-[#eef0fe] cursor-pointer relative select-none">
        <Highlighter size={15} />
        <input type="color" defaultValue="#fde047" onMouseDown={e => e.stopPropagation()}
          onInput={e => highlight((e.target as HTMLInputElement).value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
      </label>
      <Sep />

      <Btn title="Align left"   onAction={() => align('left')}><AlignLeft size={15} /></Btn>
      <Btn title="Align centre" onAction={() => align('center')}><AlignCenter size={15} /></Btn>
      <Btn title="Align right"  onAction={() => align('right')}><AlignRight size={15} /></Btn>
      <Btn title="Justify"      onAction={() => align('justify')}><AlignJustify size={15} /></Btn>
      <Sep />

      <Btn title="Bullet list"   onAction={() => makeList(false)}><List size={15} /></Btn>
      <Btn title="Numbered list" onAction={() => makeList(true)}><ListOrdered size={15} /></Btn>
      <Btn title="Indent"        onAction={() => indent(24)}><IndentIncrease size={15} /></Btn>
      <Btn title="Outdent"       onAction={() => indent(-24)}><IndentDecrease size={15} /></Btn>
      <Sep />

      {/* Table structure — act on the selected cells/rows/columns (or right-click for the full menu). */}
      <Btn title="Insert row below"            onAction={() => insertRow(true)}><Rows3 size={15} /></Btn>
      <Btn title="Delete selected row(s)"      onAction={deleteRows}><Rows3 size={15} className="text-[#b91c1c]" /></Btn>
      <Btn title="Insert column to the right"  onAction={() => insertCol(true)}><Columns3 size={15} /></Btn>
      <Btn title="Delete selected column(s)"   onAction={deleteCols}><Columns3 size={15} className="text-[#b91c1c]" /></Btn>
      <Btn title="Clear cell contents"         onAction={clearContents}><Eraser size={15} /></Btn>
      <Btn title="Toggle cell borders"         onAction={toggleBorders}><Square size={15} /></Btn>
      <Sep />

      {/* Vertical alignment of the selected cells. */}
      <Btn title="Align top"    onAction={() => vAlign('top')}><AlignVerticalJustifyStart size={15} /></Btn>
      <Btn title="Align middle" onAction={() => vAlign('middle')}><AlignVerticalJustifyCenter size={15} /></Btn>
      <Btn title="Align bottom" onAction={() => vAlign('bottom')}><AlignVerticalJustifyEnd size={15} /></Btn>
      <Sep />

      {/* Clipboard (also Ctrl/Cmd+C / X / V). */}
      <Btn title="Copy (⌘/Ctrl+C)"  onAction={copySel}><Copy size={15} /></Btn>
      <Btn title="Cut (⌘/Ctrl+X)"   onAction={cutSel}><Scissors size={15} /></Btn>
      <Btn title="Paste (⌘/Ctrl+V)" onAction={pasteSel}><ClipboardPaste size={15} /></Btn>
      <Sep />

      <Btn title="Clear formatting" onAction={clearFormat}><RemoveFormatting size={15} /></Btn>

      {menu && createPortal(
        <CellContextMenu
          x={menu.x} y={menu.y} onClose={() => setMenu(null)}
          actions={{
            copy: copySel, cut: cutSel, paste: pasteSel,
            insertRowAbove: () => insertRow(false), insertRowBelow: () => insertRow(true), deleteRows,
            insertColLeft: () => insertCol(false), insertColRight: () => insertCol(true), deleteCols,
            clearContents, toggleBorders,
          }}
        />, document.body)}
    </div>
  );
}

/** Right-click table menu — Excel/Sheets-style operations on the cell selection. */
function CellContextMenu({ x, y, onClose, actions }: {
  x: number; y: number; onClose: () => void;
  actions: {
    copy: () => void; cut: () => void; paste: () => void;
    insertRowAbove: () => void; insertRowBelow: () => void; deleteRows: () => void;
    insertColLeft: () => void; insertColRight: () => void; deleteCols: () => void;
    clearContents: () => void; toggleBorders: () => void;
  };
}) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const Item = ({ label, danger, icon: Icon, kbd, onPick }: { label: string; danger?: boolean; icon: typeof Rows3; kbd?: string; onPick: () => void }) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onPick(); onClose(); }}
      className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-left hover:bg-[#eef0fe] transition-colors",
        danger ? "text-[#b91c1c] hover:bg-[#fdf3f3]" : "text-[#34353f]")}
    >
      <Icon size={14} /> <span className="flex-1">{label}</span>
      {kbd && <kbd className="text-[10px] text-[#3a3b45]">{kbd}</kbd>}
    </button>
  );
  // Keep the menu on-screen.
  const top = Math.min(y, window.innerHeight - 420);
  const left = Math.min(x, window.innerWidth - 230);
  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      className="fixed z-[60] w-[222px] rounded-xl border border-[#e6e7ee] bg-white py-1.5 shadow-[0_12px_40px_-8px_rgba(20,21,28,0.25)]"
      style={{ top, left }}
    >
      <Item label="Cut"   icon={Scissors}       kbd="⌘X" onPick={actions.cut} />
      <Item label="Copy"  icon={Copy}           kbd="⌘C" onPick={actions.copy} />
      <Item label="Paste" icon={ClipboardPaste} kbd="⌘V" onPick={actions.paste} />
      <div className="my-1 h-px bg-[#eef0f4]" />
      <Item label="Insert row above"   icon={Rows3}    onPick={actions.insertRowAbove} />
      <Item label="Insert row below"   icon={Rows3}    onPick={actions.insertRowBelow} />
      <Item label="Delete row(s)"      icon={Rows3}    danger onPick={actions.deleteRows} />
      <div className="my-1 h-px bg-[#eef0f4]" />
      <Item label="Insert column left"  icon={Columns3} onPick={actions.insertColLeft} />
      <Item label="Insert column right" icon={Columns3} onPick={actions.insertColRight} />
      <Item label="Delete column(s)"    icon={Columns3} danger onPick={actions.deleteCols} />
      <div className="my-1 h-px bg-[#eef0f4]" />
      <Item label="Toggle borders"     icon={Square}   onPick={actions.toggleBorders} />
      <Item label="Clear contents"     icon={Eraser}   kbd="Del" onPick={actions.clearContents} />
    </div>
  );
}

/** Compact report, paginated across A4 sheets by MEASURING each panel. Rules the user asked for:
 *  • every page carries the letterhead + patient name box + footer (proper discipline)
 *  • a panel is never split across a page — if it doesn't fully fit, the whole panel moves
 *    to the next page (wastes space, but keeps each test's values together)
 *  • a configurable blank gap is reserved at the bottom of every page. */
const PX_PER_MM = 96 / 25.4;

type PanelGroup = { panel: Panel; orders: OrderWithResult[] };
type CompactBlock = { key: string; dept: string; showDept: boolean; showSub: boolean; kind: 'panel' | 'comment'; pg?: PanelGroup; comment?: string };
/** Lab-wide, per-panel page-layout template: keyed by panel code (e.g. 'CBC'). `brk` = manual
 *  page placement (pull up / push to new page); `sx`/`sy` = the page's saved width/height scale. */
type PanelLayout = Record<string, { brk?: 'pull' | 'before'; sx?: number; sy?: number }>;

type PageScale = { sx: number; sy: number };

/** Renders a saved manual-edit (override) report from its stored HTML, while keeping the
 *  per-page drag-resize working. The saved HTML preserves the [data-scale-frame] wrapper and
 *  [data-editable-body] section for each page (startEdit strips only their inline scaling), so
 *  here we fill the HTML imperatively (React doesn't manage the inner DOM), measure each page's
 *  natural content size, inject 8 resize handles per page, and re-apply the transform when the
 *  user drags. Handles are tagged data-report-control so pdf.ts strips them from the output. */
function EditedReportView({ html, logoData, className, styleVars, overrides, onChange, onReset }: {
  html: string;
  logoData?: string;
  className: string;
  styleVars: React.CSSProperties;
  overrides: Record<number, PageScale>;
  onChange: (idx: number, sx: number, sy: number) => void;
  onReset: (idx: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const natRef = useRef<Record<number, { w: number; h: number; syMax: number; base: number }>>({});
  const ovRef = useRef(overrides); ovRef.current = overrides;
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const onResetRef = useRef(onReset); onResetRef.current = onReset;
  const dragRef = useRef<{ startX: number; startY: number; sx: number; sy: number; idx: number; nat: { w: number; h: number; syMax: number; base: number }; dir: string } | null>(null);

  const partsFor = (root: HTMLElement, idx: number) => {
    const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-report-page]'));
    const pg = pages[idx];
    if (!pg) return null;
    const frame = pg.querySelector<HTMLElement>('[data-scale-frame]');
    const sec = frame?.querySelector<HTMLElement>('[data-editable-body]') ?? pg.querySelector<HTMLElement>('[data-editable-body]');
    return sec ? { pg, frame, sec } : null;
  };

  const applyTransforms = () => {
    const root = ref.current; if (!root) return;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-report-page]'));
    pages.forEach((_, idx) => {
      const p = partsFor(root, idx); const nat = natRef.current[idx];
      if (!p || !nat) return;
      const ov = ovRef.current[idx];
      // No manual override → use the auto-fit base scale so tall content shrinks to the A4 page
      // (instead of letting the page stretch). With an override, honour the user's size but still
      // clamp height to the footer line (nat.syMax) so the box can't sit below the page — this also
      // repairs reports saved with an over-large height before this clamp existed.
      const sx = ov ? ov.sx : nat.base;
      const sy = Math.min(ov ? ov.sy : nat.base, nat.syMax);
      p.sec.style.position = 'absolute'; p.sec.style.top = '0'; p.sec.style.left = '0';
      p.sec.style.width = `${nat.w}px`;
      p.sec.style.transform = `scale(${sx}, ${sy})`; p.sec.style.transformOrigin = 'top left';
      if (p.frame) { p.frame.style.width = `${nat.w * sx}px`; p.frame.style.height = `${nat.h * sy}px`; }
      const badge = p.pg.querySelector<HTMLElement>('[data-scale-badge]');
      if (badge) badge.textContent = `W ${Math.round(sx * 100)}% · H ${Math.round(sy * 100)}%`;
      const reset = p.pg.querySelector<HTMLElement>('[data-scale-reset]');
      if (reset) reset.style.display = ov ? '' : 'none';
    });
  };

  const startDrag = (e: MouseEvent, idx: number, dir: string) => {
    e.preventDefault(); e.stopPropagation();
    const nat = natRef.current[idx]; if (!nat) return;
    const ov = ovRef.current[idx];
    dragRef.current = { startX: e.clientX, startY: e.clientY, sx: ov ? ov.sx : nat.base, sy: ov ? ov.sy : nat.base, idx, nat, dir };
    const move = (ev: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const dx = ev.clientX - d.startX, dy = ev.clientY - d.startY;
      let nsx = d.sx, nsy = d.sy;
      if (d.dir.includes('e')) nsx = d.sx + dx / d.nat.w;
      if (d.dir.includes('w')) nsx = d.sx - dx / d.nat.w;
      if (d.dir.includes('s')) nsy = d.sy + dy / d.nat.h;
      if (d.dir.includes('n')) nsy = d.sy - dy / d.nat.h;
      nsx = Math.min(1, Math.max(0.5, nsx));
      nsy = Math.min(d.nat.syMax, Math.max(0.5, nsy));
      onChangeRef.current(d.idx, +nsx.toFixed(3), +nsy.toFixed(3));
    };
    const up = () => { dragRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  };

  const injectControls = (host: HTMLElement, pg: HTMLElement, idx: number) => {
    const HANDLES: [string, Partial<CSSStyleDeclaration>][] = [
      ['nw', { top: '-5px', left: '-5px', cursor: 'nwse-resize' }],
      ['n', { top: '-5px', left: '50%', marginLeft: '-5px', cursor: 'ns-resize' }],
      ['ne', { top: '-5px', right: '-5px', cursor: 'nesw-resize' }],
      ['e', { top: '50%', right: '-5px', marginTop: '-5px', cursor: 'ew-resize' }],
      ['se', { bottom: '-5px', right: '-5px', cursor: 'nwse-resize' }],
      ['s', { bottom: '-5px', left: '50%', marginLeft: '-5px', cursor: 'ns-resize' }],
      ['sw', { bottom: '-5px', left: '-5px', cursor: 'nesw-resize' }],
      ['w', { top: '50%', left: '-5px', marginTop: '-5px', cursor: 'ew-resize' }],
    ];
    for (const [dir, css] of HANDLES) {
      const el = document.createElement('div');
      el.setAttribute('data-report-control', '');
      Object.assign(el.style, { position: 'absolute', width: '10px', height: '10px', background: '#6366f1', border: '1.5px solid #fff', borderRadius: '2px', boxShadow: '0 0 0 1px #6366f1', zIndex: '12' } as Partial<CSSStyleDeclaration>, css);
      el.addEventListener('mousedown', (ev) => startDrag(ev, idx, dir));
      host.appendChild(el);
    }
    // W×H badge + reset, top-right of the frame
    const bar = document.createElement('div');
    bar.setAttribute('data-report-control', '');
    Object.assign(bar.style, { position: 'absolute', top: '-18px', right: '0', display: 'flex', gap: '4px', alignItems: 'center', zIndex: '13' } as Partial<CSSStyleDeclaration>);
    const badge = document.createElement('span');
    badge.setAttribute('data-scale-badge', '');
    Object.assign(badge.style, { fontSize: '9px', background: '#6366f1', color: '#fff', padding: '0 4px', borderRadius: '3px', lineHeight: '1.4' } as Partial<CSSStyleDeclaration>);
    const reset = document.createElement('button');
    reset.type = 'button'; reset.textContent = 'reset'; reset.setAttribute('data-scale-reset', '');
    Object.assign(reset.style, { fontSize: '9px', background: '#fff', color: '#6366f1', border: '1px solid #c7c9ff', borderRadius: '3px', padding: '0 4px', lineHeight: '1.4', cursor: 'pointer', display: 'none' } as Partial<CSSStyleDeclaration>);
    reset.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); onResetRef.current(idx); });
    bar.appendChild(badge); bar.appendChild(reset);
    host.appendChild(bar);
    void pg;
  };

  // Fill HTML once per change, measure naturals, inject handles, then apply current transforms.
  useLayoutEffect(() => {
    const root = ref.current; if (!root) return;
    root.innerHTML = html;
    // Re-sync the letterhead logo from CURRENT settings so a logo set/changed AFTER this report
    // was manually edited still shows on every page (the saved HTML froze the old letterhead).
    try {
      root.querySelectorAll<HTMLElement>('.report-letterhead').forEach(head => {
        const row = head.querySelector<HTMLElement>(':scope > div') ?? head;
        let img = head.querySelector<HTMLImageElement>('img');
        if (logoData) {
          if (img) { img.src = logoData; }
          else {
            img = document.createElement('img');
            img.src = logoData;
            img.alt = 'logo';
            img.className = 'h-[58px] w-auto object-contain shrink-0';
            row.insertBefore(img, row.firstChild);
          }
        } else if (img) {
          img.remove();
        }
      });
    } catch { /* non-fatal */ }
    // Force every page back to a FIXED A4 sheet. Editing made pages `height:auto; overflow:visible`
    // so all content was visible while editing; if that leaks into the saved report the page
    // stretches taller than A4 and pushes the signature/footer down (or onto a new page). Pinning
    // to 297mm + overflow:hidden here fixes both freshly-saved and previously-saved edited reports.
    root.querySelectorAll<HTMLElement>('.report-page').forEach(p => {
      p.style.height = '297mm';
      p.style.minHeight = '297mm';
      p.style.overflow = 'hidden';
    });
    const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-report-page]'));
    const nat: Record<number, { w: number; h: number; syMax: number; base: number }> = {};
    pages.forEach((pg, idx) => {
      const p = partsFor(root, idx); if (!p) return;
      // Older overrides (saved before the resize feature) have no [data-scale-frame] wrapper.
      // Create one so the absolute+scaled section has a real sized layout box.
      let frame = p.frame;
      if (!frame && p.sec.parentElement) {
        frame = document.createElement('div');
        frame.setAttribute('data-scale-frame', '');
        frame.style.position = 'relative';
        p.sec.parentElement.insertBefore(frame, p.sec);
        frame.appendChild(p.sec);
      }
      // Reset to natural to measure the unscaled content box.
      p.sec.style.position = ''; p.sec.style.transform = ''; p.sec.style.width = ''; p.sec.style.top = ''; p.sec.style.left = '';
      if (frame) { frame.style.width = ''; frame.style.height = ''; }
      const w = p.sec.offsetWidth || 186 * PX_PER_MM;
      const h = p.sec.offsetHeight || 1;
      // Height can stretch down to the footer/signature line within the body region.
      const body = p.sec.closest<HTMLElement>('.report-body');
      const frameTop = frame ? frame.offsetTop : p.sec.offsetTop;
      const avail = body ? body.clientHeight - frameTop : h * 2;
      // Ceiling = fill EXACTLY down to the footer/signature line and NEVER past it. The resize
      // box's bottom is the frame bottom = frameTop + h*sy; capping sy at avail/h means that
      // bottom can reach at most the page's body bottom (just above the signature) — so the
      // person can't drag the resizable square outside the page. (No `,1` floor: that previously
      // let a tall panel stretch to its full natural height, dropping the box below the sheet.)
      const syMax = avail > 0 ? avail / h : 1;
      // Auto-fit: if the content is taller than the A4 body area, shrink it to fit (never enlarge).
      // This is the default size when the user hasn't manually resized — it keeps the page at A4.
      const base = avail > 0 && h > avail ? +(avail / h).toFixed(3) : 1;
      nat[idx] = { w, h, syMax, base };
      const host = frame ?? (p.sec.parentElement as HTMLElement);
      if (host && getComputedStyle(host).position === 'static') host.style.position = 'relative';
      if (host) injectControls(host, pg, idx);
    });
    natRef.current = nat;
    applyTransforms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, logoData]);

  // Re-apply transforms whenever the per-page scale changes.
  useLayoutEffect(() => { applyTransforms(); }, [overrides]);   // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} id="report-print-area" className={className} style={styleVars} />;
}

function CompactPaginatedReport({
  sortedPanels, deptOf, renderPanelBody, comment, bottomGapMm, contentScale, measureKey,
  panelLayout, onPanelMove, onPanelScale, onPanelScaleReset, editing, repeatNameBox, nameBoxSkipPage,
  Watermark, Letterhead, PatientStrip, PageFooter,
}: {
  sortedPanels: PanelGroup[];
  deptOf: (p: Panel) => string;
  renderPanelBody: (pg: PanelGroup) => React.ReactNode;
  comment: string;
  bottomGapMm: number;
  contentScale: number;
  editing?: boolean;
  repeatNameBox?: boolean;
  nameBoxSkipPage?: number;
  measureKey: string;
  // Lab-wide, per-panel layout template (keyed by panel code) + writers.
  panelLayout: PanelLayout;
  onPanelMove: (code: string, dir: 'up' | 'down') => void;
  onPanelScale: (code: string, sx: number, sy: number) => void;
  onPanelScaleReset: (code: string) => void;
  Watermark: React.ComponentType;
  Letterhead: React.ComponentType;
  PatientStrip: React.ComponentType;
  PageFooter: React.ComponentType<{ pageIndex: number; total: number; isLast: boolean }>;
}) {
  // Ordered list of atomic blocks (one per panel, plus an optional comment block).
  const blocks = useMemo<CompactBlock[]>(() => {
    const out: CompactBlock[] = [];
    let prevDept = '';
    sortedPanels.forEach((pg, i) => {
      const dept = deptOf(pg.panel);
      out.push({
        key: `${pg.panel.code}-${i}`,
        dept,
        showDept: dept !== prevDept,
        showSub: !sameHeading(pg.panel.report_heading, dept),
        kind: 'panel',
        pg,
      });
      prevDept = dept;
    });
    if (comment.trim()) out.push({ key: '__comment', dept: '', showDept: false, showSub: false, kind: 'comment', comment });
    return out;
  }, [sortedPanels, comment, deptOf]);

  const measureRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [capacity, setCapacity] = useState(0);
  // Full usable body height with NO bottom-gap reserved — the real distance from the content
  // top down to the footer/signature line. Used as the manual-resize height ceiling so a page
  // can be stretched right down to the signature (the bottom gap is only for auto-pagination).
  const [capacityFull, setCapacityFull] = useState(0);

  // Re-measure whenever the block set or the bottom gap changes.
  const sig = blocks.map(b => b.key).join('|') + `#${bottomGapMm}#${measureKey}`;
  useLayoutEffect(() => {
    const measure = () => {
      const probe = probeRef.current;
      const full = probe ? probe.clientHeight : 0;
      setCapacityFull(full > 0 ? full : 0);
      const cap = full ? full - bottomGapMm * PX_PER_MM : 0;
      setCapacity(cap > 0 ? cap : 0);
      const root = measureRef.current;
      if (root) {
        const h: Record<string, number> = {};
        root.querySelectorAll<HTMLElement>('[data-block-key]').forEach(el => {
          h[el.dataset.blockKey!] = el.offsetHeight;
        });
        setHeights(h);
      }
    };
    measure();
    // Re-measure once the letterhead/signature images have decoded (their height affects
    // how much room is left for panels — a stale measure would break pages in the wrong place).
    const imgs = Array.from(measureRef.current?.closest('[aria-hidden]')?.querySelectorAll('img') ?? []);
    const pending = imgs.filter(im => !im.complete);
    pending.forEach(im => { im.addEventListener('load', measure, { once: true }); im.addEventListener('error', measure, { once: true }); });
    const t = setTimeout(measure, 300);
    return () => { clearTimeout(t); pending.forEach(im => { im.removeEventListener('load', measure); im.removeEventListener('error', measure); }); };
  }, [sig]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Greedily pack whole blocks into pages, honouring manual overrides:
  //   'before' → always start a fresh page (push this panel DOWN)
  //   'pull'   → never break before (drag this panel UP onto the previous page)
  // Each page also gets an auto-fit `scale`: if its blocks are still taller than the A4 body
  // (e.g. one long panel that can't be split), that page shrinks just enough to fit — so a
  // panel is NEVER clipped and every page fills exactly one A4 sheet.
  // Content-based height ESTIMATE (px) — used when the off-screen measurement isn't available
  // or looks wrong. Guarantees long reports paginate across pages instead of cramming onto one.
  const estimateH = (b: CompactBlock): number => {
    if (b.kind !== 'panel' || !b.pg) return 40;
    const ROW = 26, NOTE = 72, COLHEAD = 34;
    let h = (b.showDept ? 32 : 0) + (b.showSub ? 26 : 0) + COLHEAD;
    h += b.pg.orders.length * ROW;
    h += b.pg.orders.filter(o => o.test.interpretation_note).length * NOTE;
    if (b.pg.panel.code === 'CBC') h = Math.max(h, 320);   // histograms occupy ~3×100px
    return h;
  };
  // Trust the measured height only when it's a sane non-zero value; otherwise estimate.
  const blockH = (b: CompactBlock): number => {
    const m = heights[b.key];
    return m && m > 10 ? m : estimateH(b);
  };

  const pages = useMemo<{ blocks: CompactBlock[]; scale: number }[]>(() => {
    if (!blocks.length) return [];
    const cap = capacity > 0 ? capacity : 165 * PX_PER_MM;   // A4 body height (px)
    const groups: CompactBlock[][] = [];
    let cur: CompactBlock[] = [];
    let curH = 0;
    for (const b of blocks) {
      const h = blockH(b) * contentScale;   // scaled content takes scaled space
      const br = b.pg ? panelLayout[b.pg.panel.code]?.brk : undefined;
      const overflow = curH + h > cap;
      if (cur.length && (br === 'before' || (br !== 'pull' && overflow))) {
        groups.push(cur); cur = []; curH = 0;
      }
      cur.push(b);
      curH += h;
    }
    if (cur.length) groups.push(cur);
    // Per-page auto-fit scale — only shrinks a page whose content still overflows one A4 sheet
    // (e.g. a single very long panel); never enlarges beyond the user's contentScale.
    return groups.map(g => {
      const rawH = g.reduce((s, b) => s + blockH(b), 0);
      const wanted = rawH * contentScale;
      // 0.96 safety margin so a slight measurement under-estimate can't let a tall panel bleed
      // past the page edge onto the footer / next page.
      const scale = wanted > cap && rawH > 0 ? (cap / rawH) * 0.96 : contentScale;
      return { blocks: g, scale };
    });
  }, [blocks, heights, capacity, panelLayout, contentScale]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** The panel code that "owns" a page = the first panel block on it (the one whose heading
   *  leads the page). Page-scale adjustments are saved against this code so they persist. */
  const pageOwnerCode = (page: { blocks: CompactBlock[] }): string =>
    page.blocks.find(b => b.kind === 'panel' && b.pg)?.pg!.panel.code ?? '';

  // Live per-page stretch ceiling: the REAL distance from each page's content frame to its
  // footer (signature) line, measured from the rendered DOM. This is what lets a short panel be
  // stretched down to exactly just above the signature — independent of the off-screen probe.
  const pagesWrapRef = useRef<HTMLDivElement>(null);
  const [ceilings, setCeilings] = useState<Record<number, number>>({});
  useLayoutEffect(() => {
    const root = pagesWrapRef.current; if (!root) return;
    const measure = () => {
      const pgs = Array.from(root.querySelectorAll<HTMLElement>('[data-report-page]'));
      const next: Record<number, number> = {};
      pgs.forEach((pg, i) => {
        const frame = pg.querySelector<HTMLElement>('[data-scale-frame]');
        const foot = pg.querySelector<HTMLElement>('.report-letterfoot');
        if (!frame || !foot) return;
        const c = foot.getBoundingClientRect().top - frame.getBoundingClientRect().top;
        if (c > 40) next[i] = c;
      });
      setCeilings(prev => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)].map(Number));
        let changed = false;
        keys.forEach(k => { if (Math.abs((prev[k] || 0) - (next[k] || 0)) > 1) changed = true; });
        return changed ? next : prev;
      });
    };
    measure();
    const t = setTimeout(measure, 250);
    return () => clearTimeout(t);
  }, [pages, capacityFull, panelLayout, sig]);   // eslint-disable-line react-hooks/exhaustive-deps

  const BlockView = ({ b, first, controls }: { b: CompactBlock; first: boolean; controls?: boolean }) => {
    // paddingTop (not margin) so measurement never disagrees with layout via margin-collapse.
    const padTop = first ? 0 : b.showDept ? 18 : 8;
    // Move-between-pages controls (screen only): ↑ pulls this panel onto the previous page,
    // ↓ pushes it to start a fresh page. data-report-control → stripped from PDF/print/edit.
    const moveControls = controls && b.kind === 'panel' ? (
      <div
        data-report-control
        contentEditable={false}
        className="report-control absolute -top-1 right-0 z-10 flex gap-1 opacity-0 group-hover/blk:opacity-100 transition-opacity print:hidden"
      >
        <button
          type="button" title="Move this test UP to the previous page (saved for this test)"
          onClick={() => b.pg && onPanelMove(b.pg.panel.code, 'up')}
          className={cn("h-6 w-6 inline-flex items-center justify-center rounded-md border bg-white shadow-sm",
            (b.pg && panelLayout[b.pg.panel.code]?.brk === 'pull') ? "border-[#4f46e5] text-[#4f46e5]" : "border-[#e6e7ee] text-[#3a3b45] hover:border-[#c7c9ff] hover:text-[#4f46e5]")}
        ><ArrowUp size={13} /></button>
        <button
          type="button" title="Move this test DOWN to a new page (saved for this test)"
          onClick={() => b.pg && onPanelMove(b.pg.panel.code, 'down')}
          className={cn("h-6 w-6 inline-flex items-center justify-center rounded-md border bg-white shadow-sm",
            (b.pg && panelLayout[b.pg.panel.code]?.brk === 'before') ? "border-[#4f46e5] text-[#4f46e5]" : "border-[#e6e7ee] text-[#3a3b45] hover:border-[#c7c9ff] hover:text-[#4f46e5]")}
        ><ArrowDown size={13} /></button>
      </div>
    ) : null;

    if (b.kind === 'comment') {
      return <div data-block-key={b.key} style={{ paddingTop: padTop }} className="text-[11px]"><strong>Comments :</strong> {b.comment}</div>;
    }
    return (
      <div data-block-key={b.key} style={{ paddingTop: padTop }} className="group/blk relative">
        {moveControls}
        {b.showDept && (
          <div className="text-center font-bold text-[14.5px] tracking-wide text-black underline underline-offset-2 mb-1">{b.dept}</div>
        )}
        {b.showSub && (
          <div className="font-bold text-[14px] text-black underline underline-offset-2 mt-2 mb-1">{b.pg!.panel.report_heading}</div>
        )}
        {renderPanelBody(b.pg!)}
      </div>
    );
  };

  const pageStyle: React.CSSProperties = {
    width: '210mm', height: '297mm', overflow: 'hidden', padding: '12mm', boxSizing: 'border-box',
    fontFamily: '"Helvetica Neue", Arial, "Liberation Sans", system-ui, sans-serif',
    color: '#111', WebkitFontSmoothing: 'antialiased',
  };

  // Per-page drag state (ref so no re-render during drag). dir is one of the 8 compass points.
  // NOTE: this useRef MUST stay above the early `return` below — calling a hook after a
  // conditional return violates the Rules of Hooks and crashes when `blocks` is briefly empty.
  const pageResizeDrag = useRef<{
    startX: number; startY: number; startSx: number; startSy: number;
    idx: number; code: string; naturalW: number; naturalH: number; sxMax: number; syMax: number; dir: string;
  } | null>(null);

  if (!blocks.length) {
    return (
      <div data-report-page className="report-page bg-white shadow-sm relative mx-auto flex flex-col" style={pageStyle}>
        <Watermark /><Letterhead />
        <div className="report-body relative flex-1">
          <PatientStrip />
          <div className="text-center text-gray-400 py-10 text-[14px]">No results entered yet.</div>
        </div>
        <PageFooter pageIndex={0} total={1} isLast={true} />
      </div>
    );
  }

  const startPageResize = (
    e: React.MouseEvent, idx: number, code: string,
    o: { startSx: number; startSy: number; naturalW: number; naturalH: number; sxMax: number; syMax: number; dir: string },
  ) => {
    e.preventDefault(); e.stopPropagation();
    pageResizeDrag.current = { startX: e.clientX, startY: e.clientY, idx, code, ...o };
    const onMove2 = (ev: MouseEvent) => {
      const d = pageResizeDrag.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      // Dragging a handle OUTWARD enlarges that dimension, INWARD shrinks it. Side handles
      // (e/w) change WIDTH only; top/bottom (n/s) change HEIGHT only; corners change BOTH
      // (diagonal). Width grows rightward, height grows downward (content is pinned top-left).
      let nsx = d.startSx, nsy = d.startSy;
      if (d.dir.includes('e')) nsx = d.startSx + dx / d.naturalW;   // right edge out → wider
      if (d.dir.includes('w')) nsx = d.startSx - dx / d.naturalW;   // left edge out (←) → wider
      if (d.dir.includes('s')) nsy = d.startSy + dy / d.naturalH;   // bottom out (↓) → taller
      if (d.dir.includes('n')) nsy = d.startSy - dy / d.naturalH;   // top out (↑) → taller
      nsx = Math.min(d.sxMax, Math.max(0.5, nsx));
      nsy = Math.min(d.syMax, Math.max(0.5, nsy));
      if (d.code) onPanelScale(d.code, +nsx.toFixed(3), +nsy.toFixed(3));
    };
    const onUp = () => { pageResizeDrag.current = null; document.removeEventListener('mousemove', onMove2); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove2);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {/* Visible, paginated pages */}
      <div ref={pagesWrapRef} className="contents">
      {pages.map((page, idx) => {
        // Natural (unscaled) content box, in px. Width = body content width (186mm);
        // height = measured sum of this page's blocks.
        const naturalW = 186 * PX_PER_MM;
        const naturalH = Math.max(page.blocks.reduce((s, b) => s + blockH(b), 0), 1);
        // Resize ceiling = the REAL frame→signature distance for this page (measured live), so a
        // short panel can stretch all the way down to just above the signature. Falls back to the
        // off-screen probe height before the first measurement lands.
        const fullH = (ceilings[idx] && ceilings[idx] > 40)
          ? ceilings[idx]
          : (capacityFull > 0 ? capacityFull : (capacity > 0 ? capacity : 230 * PX_PER_MM));
        const base = page.scale;                          // auto-fit scale (uniform)
        // Scale comes from the per-panel template (keyed by the page's owning panel), so a saved
        // adjustment for e.g. CBC re-applies to every report's CBC page automatically.
        const ownerCode = pageOwnerCode(page);
        const ov = ownerCode ? panelLayout[ownerCode] : undefined;
        // `fitH` = the exact scale at which the box's bottom lands on the footer/signature line
        // (fullH is the live-measured frame→footer distance). The resize box's bottom is
        // frameTop + naturalH*sy, so sy must NEVER exceed fitH or the box drops below the page.
        const fitH = naturalH > 0 ? fullH / naturalH : 1;
        const sx = ov?.sx != null ? ov.sx : base;
        // Hard-clamp the displayed height to the footer line — even a saved over-large override or
        // an over-generous auto-fit can't push the box (and its handles) off the sheet.
        const sy = Math.min(ov?.sy != null ? ov.sy : base, fitH);
        const sxMax = 1;
        const syMax = fitH;   // can fill down to the signature, never past it
        const overridden = ov?.sx != null;
        // 8 bounding-box handles (Google-Slides style), positioned on the SCALED frame.
        const HANDLES: { dir: string; pos: React.CSSProperties }[] = [
          { dir: 'nw', pos: { top: -5, left: -5, cursor: 'nwse-resize' } },
          { dir: 'n',  pos: { top: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
          { dir: 'ne', pos: { top: -5, right: -5, cursor: 'nesw-resize' } },
          { dir: 'e',  pos: { top: '50%', right: -5, marginTop: -5, cursor: 'ew-resize' } },
          { dir: 'se', pos: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
          { dir: 's',  pos: { bottom: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
          { dir: 'sw', pos: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
          { dir: 'w',  pos: { top: '50%', left: -5, marginTop: -5, cursor: 'ew-resize' } },
        ];
        return (
        <div
          key={idx}
          data-report-page
          className="report-page bg-white shadow-sm relative mx-auto flex flex-col group/page"
          style={{ ...pageStyle, marginBottom: idx === pages.length - 1 ? 0 : '18px' }}
        >
          <Watermark />
          <Letterhead />
          <div className="report-body relative flex-1">
            {/* Name box repeats on every page by default; shows on page 1 only when repeat is off;
                and is always omitted on the one page number the user chose to skip. */}
            {(idx === 0 || repeatNameBox) && (idx + 1 !== nameBoxSkipPage) && <PatientStrip />}
            {/* Resizable content frame. The WRAPPER takes the scaled box size (real layout, so
                it survives html2canvas/PDF capture); the SECTION is pinned top-left at natural
                size and visually scaled with a non-uniform transform (independent W/H). */}
            <div data-scale-frame className="relative mt-3" style={{ width: naturalW * sx, height: naturalH * sy }}>
              <section data-editable-body suppressContentEditableWarning
                style={{ position: 'absolute', top: 0, left: 0, width: naturalW, transform: `scale(${sx}, ${sy})`, transformOrigin: 'top left' }}>
                {page.blocks.map((b, i) => <BlockView key={b.key} b={b} first={i === 0} controls />)}
              </section>
              {!editing && (
                <div data-report-control className="absolute inset-0 pointer-events-none print:hidden" style={{ zIndex: 12 }}>
                  {/* selection outline — only visible on hover of the page */}
                  <div className="absolute inset-0 border border-dashed border-[#a5b4fc] opacity-0 group-hover/page:opacity-100 transition-opacity rounded-sm" />
                  {/* 8 drag handles */}
                  {HANDLES.map(h => (
                    <div key={h.dir}
                      onMouseDown={e => startPageResize(e, idx, ownerCode, { startSx: sx, startSy: sy, naturalW, naturalH, sxMax, syMax, dir: h.dir })}
                      className="absolute opacity-0 group-hover/page:opacity-100 transition-opacity pointer-events-auto"
                      style={{ width: 10, height: 10, background: '#6366f1', border: '1.5px solid #fff', borderRadius: 2, boxShadow: '0 0 0 1px #6366f1', ...h.pos }} />
                  ))}
                  {/* W×H badge + reset, top-right corner of the frame */}
                  <div className="absolute -top-5 right-0 flex items-center gap-1 opacity-0 group-hover/page:opacity-100 transition-opacity pointer-events-auto">
                    <span className="text-[9px] tabular-nums px-1 rounded bg-[#6366f1] text-white leading-tight">W {Math.round(sx * 100)}% · H {Math.round(sy * 100)}%</span>
                    {overridden && (
                      <button type="button" onClick={() => ownerCode && onPanelScaleReset(ownerCode)}
                        className="text-[9px] px-1 rounded bg-white border border-[#c7c9ff] text-[#6366f1] leading-tight hover:bg-[#eef0fe]"
                        title="Reset this test's page to auto">reset</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <PageFooter pageIndex={idx} total={pages.length} isLast={idx === pages.length - 1} />
        </div>
        );
      })}
      </div>

      {/* Hidden measurers — PORTALED to <body> so they're never inside #report-print-area
          (which would double content in the PDF capture and the "Edit report" HTML seed).
          Off-screen and not [data-report-page], so print/PDF/edit all ignore them. */}
      {createPortal(
        <div aria-hidden style={{ position: 'absolute', left: '-10000px', top: 0, pointerEvents: 'none' }}>
          {/* Capacity probe: a real page whose flex-1 body region reveals the usable content height. */}
          <div className="flex flex-col" style={pageStyle}>
            <Letterhead />
            <div className="report-body flex flex-col flex-1">
              <PatientStrip />
              <div ref={probeRef} className="mt-3" style={{ flex: 1 }} />
            </div>
            <PageFooter pageIndex={0} total={2} isLast={true} />
          </div>
          {/* Per-block height measurer at the true body content width (210mm − 24mm padding). */}
          <div ref={measureRef} style={{ width: '186mm' }}>
            {blocks.map(b => <BlockView key={b.key} b={b} first={false} />)}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function OutputBtn({ icon: Icon, label, onClick, done, disabled, busy, primary, green }: {
  icon: typeof Printer; label: string; onClick: () => void; done?: boolean; disabled?: boolean; busy?: boolean; primary?: boolean; green?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled || busy} title={disabled ? 'Approve the report first' : undefined}
      className={cn("w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
        green ? "text-white bg-gradient-to-b from-[#16a34a] to-[#15803d] hover:brightness-110 shadow-[0_2px_8px_-2px_rgba(21,128,61,0.5)]"
          : primary ? "text-white btn-accent"
            : "border border-[#e6e7ee] text-[#34353f] hover:bg-[#fafafe] hover:border-[#c7c9ff]")}>
      <Icon size={16} /> {busy ? '…' : label} {done && <Check size={13} className={green || primary ? 'text-white' : 'text-[#16a34a]'} />}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-gray-600">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={cn("w-9 h-5 rounded-full transition-colors relative", checked ? "bg-[#6366f1]" : "bg-gray-300")}>
        <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all", checked ? "left-4" : "left-0.5")} />
      </button>
    </label>
  );
}

function GapInput({ label, value, onChange, max = 120, unit = 'mm' }: { label: string; value: number; onChange: (v: number) => void; max?: number; unit?: string }) {
  return (
    <label className="flex items-center justify-between text-[11.5px] text-[#3a3b45]">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number" min={0} max={max} value={value}
          // Empty/partial input is left as-is (don't snap to 0 mid-typing); only commit a finite number.
          onChange={(e) => { const v = e.target.value; if (v === '') return; const n = Number(v); if (Number.isFinite(n)) onChange(Math.max(0, Math.min(max, n))); }}
          className="w-14 rounded border border-[#d8d3cc] bg-white px-2 py-1 text-right tabular-nums"
        />
        <span className="text-[#4c4e5d]">{unit}</span>
      </span>
    </label>
  );
}

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{k}</span>
      <span className={cn("tabular-nums font-medium", danger ? "text-red-600" : "text-gray-900")}>{v}</span>
    </div>
  );
}
