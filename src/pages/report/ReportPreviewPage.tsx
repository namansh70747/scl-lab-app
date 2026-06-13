import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPatientById, getBill } from "@/lib/queries/patients";
import { getOrdersWithResults, getReportComment } from "@/lib/queries/results";
import { listPanels } from "@/lib/queries/tests";
import { getAllSettings } from "@/lib/queries/settings";
import { logDelivery, hasDelivered } from "@/lib/queries/delivery";
import { computeCalculated, resolveCalculated } from "@/lib/calc";
import { computeFlag, patientAgeDays, findRange, displayRange } from "@/lib/flags";
import { generateReportQR } from "@/lib/qr";
import { revealInFolder } from "@/lib/printing";
import { saveReportPdf, printReportPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";
import { buildWhatsAppMessage, sendWhatsAppSemi } from "@/lib/whatsapp";
import { formatDate } from "@/lib/format";
import { getHistograms } from "@/lib/queries/analyzer";
import { HistogramRow } from "@/components/report/Histogram";
import { OrderWithResult, Panel } from "@/types";
import { ChevronLeft, Printer, FileDown, MessageCircle, Mail, Check, ZoomIn, ZoomOut, Smartphone } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { SCLLogo } from "@/components/common/SCLLogo";

const NORMAL_QUALITATIVE = new Set(['NEGATIVE', 'NIL', 'NOT SEEN', 'ABSENT', 'NORMAL', 'CLEAR', 'PALE YELLOW']);

/**
 * Which discipline each panel prints under. On the printed report the discipline
 * (e.g. BIOCHEMISTRY) is a single centred heading, and the individual profiles within
 * it (e.g. LIVER FUNCTION TEST (LFT)) appear as left-aligned underlined sub-headings —
 * exactly as on the lab's existing letterhead reports. Unmapped panels stand alone.
 */
const DEPARTMENT: Record<string, string> = {
  HEM: 'HAEMATOLOGY', CBC: 'HAEMATOLOGY', COAG: 'HAEMATOLOGY',
  BIO: 'BIOCHEMISTRY', LFT: 'BIOCHEMISTRY', KFT: 'BIOCHEMISTRY',
  LIPID: 'BIOCHEMISTRY', ELEC: 'BIOCHEMISTRY', DIAB: 'BIOCHEMISTRY',
  THY: 'BIOCHEMISTRY', HORM: 'BIOCHEMISTRY',
  SERO: 'SEROLOGY',
  URINE: 'CLINICAL PATHOLOGY', STOOL: 'CLINICAL PATHOLOGY', FLUID: 'CLINICAL PATHOLOGY',
  MICRO: 'MICROBIOLOGY',
  MISC: 'MISCELLANEOUS',
};
const deptOf = (p: Panel): string => DEPARTMENT[p.code] ?? p.report_heading;

export function ReportPreviewPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const pid = parseInt(patientId ?? '0');
  const navigate = useNavigate();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(100);
  const [showWatermark, setShowWatermark] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Pre-printed letterhead paper: when OFF, the physical print drops the header/footer
  // and shifts the body down so the data lands inside the paper's printed frame. Digital
  // copies (PDF, WhatsApp, email) always include the full letterhead.
  // Default OFF — the lab prints on pre-printed letterhead paper, so the digital header is
  // hidden and the body is positioned to land inside the paper's frame. Toggle ON for plain paper.
  const [printLetterhead, setPrintLetterhead] = useState(() => localStorage.getItem('scl_print_letterhead') === '1');
  const [preTop, setPreTop] = useState(() => Number(localStorage.getItem('scl_pre_top') ?? 40));
  const [preBottom, setPreBottom] = useState(() => Number(localStorage.getItem('scl_pre_bottom') ?? 24));
  const autoEmailTried = useRef(false);
  const autoSendTried = useRef(false);
  const [searchParams] = useSearchParams();

  const { data: patient } = useQuery({ queryKey: ['patient', pid], queryFn: () => getPatientById(pid) });
  const { data: orders = [] } = useQuery({ queryKey: ['orders', pid], queryFn: () => getOrdersWithResults(pid) });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getAllSettings });
  const { data: bill } = useQuery({ queryKey: ['bill', pid], queryFn: () => getBill(pid) });
  const { data: comment = '' } = useQuery({ queryKey: ['comment', pid], queryFn: () => getReportComment(pid) });
  const { data: histograms } = useQuery({ queryKey: ['histograms', pid], queryFn: () => getHistograms(pid) });
  const { data: qr = '' } = useQuery({
    queryKey: ['qr', pid, patient?.test_no, patient?.report_time],
    queryFn: () => generateReportQR(patient!.test_no, patient!.name, patient!.report_time),
    enabled: !!patient,
  });

  const activeOrders = orders.filter(o => !o.order.not_done);
  // Calculated rows (e.g. A/G Ratio) are derived and may be blank when their inputs don't
  // allow a value — they must NOT gate approval. Only entered (non-calculated) tests do.
  const gatingOrders = activeOrders.filter(o => o.test.result_type !== 'calculated');
  const isApproved = gatingOrders.length > 0 && gatingOrders.every(o => o.result?.approved_at);

  // Auto-email the report once, right after it is approved, if the patient has an email
  // address and SMTP is configured. Deduped via the delivery log so it never re-sends.
  useEffect(() => {
    if (autoEmailTried.current) return;
    if (!isApproved || !patient?.email || !orders.length) return;
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) return;
    autoEmailTried.current = true;
    (async () => {
      if (await hasDelivered(pid, 'email')) return;   // already emailed before
      await new Promise(r => setTimeout(r, 900));      // let the report DOM + QR settle before rasterising
      setBusy('email');
      try {
        await emailCore();
        await logDelivery(pid, 'email', patient.email!, 'sent');
        setSent(s => ({ ...s, email: true }));
      } catch (e) {
        await logDelivery(pid, 'email', patient.email!, 'failed', String(e));
      } finally {
        setBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproved, patient?.email, orders.length, settings.smtp_host, settings.smtp_user, settings.smtp_pass]);

  // Opened from the dashboard "Waiting to Send" tray with ?send=whatsapp|print — run it
  // here, where the report is rendered and the PDF can actually be produced.
  useEffect(() => {
    const action = searchParams.get('send');
    if (!action || autoSendTried.current) return;
    if (!isApproved || !patient || !orders.length) return;
    autoSendTried.current = true;
    const t = setTimeout(() => {
      if (action === 'whatsapp') handleWhatsApp();
      else if (action === 'print') handlePrint();
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
  const valuesMap = resolveCalculated(enteredMap, calcTests);

  // Group active orders by panel, preserving panel sort order.
  const panelMap = new Map<string, { panel: Panel; orders: OrderWithResult[] }>();
  for (const o of activeOrders) {
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
      const c = computeCalculated(o.test.code, o.test.formula, valuesMap);
      return c != null ? c.toFixed(o.test.decimals) : '';
    }
    return o.result?.value ?? '';
  }

  function flagOf(o: OrderWithResult): '' | 'H' | 'L' | 'A' {
    if (!patient) return '';
    const v = resultValue(o);
    if (!v) return '';
    return computeFlag(o.test.result_type, v, o.ranges, patient.sex, patientAgeDays(patient.age, patient.age_unit));
  }

  function rangeText(o: OrderWithResult): string {
    if (!patient) return '';
    return displayRange(findRange(o.ranges, patient.sex, patientAgeDays(patient.age, patient.age_unit)));
  }

  // Shared report-table fragments (used by both grouped and one-per-page layouts).
  const renderHead = () => (
    <thead>
      <tr>
        <th className="text-left pb-1 pr-2 font-bold text-black text-[12.5px]">Test Name</th>
        <th className="text-left pb-1 px-2 font-bold text-black text-[12.5px] w-28">Results</th>
        <th className="text-left pb-1 px-2 font-bold text-black text-[12.5px] w-20">Units</th>
        <th className="text-left pb-1 pl-2 font-bold text-black text-[12.5px] w-36">Normal Ranges</th>
      </tr>
    </thead>
  );
  const renderRows = (rows: OrderWithResult[]) => rows.map(o => {
    const value = resultValue(o);
    const abnormal = flagOf(o) !== '';
    return (
      <tr key={o.order.id}>
        <td className="py-[3px] pr-2 text-gray-950">{o.test.name}</td>
        <td className={cn("py-[3px] px-2 tabular-nums text-gray-950", abnormal && "font-bold")}>{value || '—'}</td>
        <td className="py-[3px] px-2 text-gray-800">{o.test.unit && o.test.unit !== '—' ? o.test.unit : ''}</td>
        <td className="py-[3px] pl-2 text-gray-800">{rangeText(o)}</td>
      </tr>
    );
  });
  const renderNotes = (rows: OrderWithResult[]) => {
    const note = rows.find(r => r.test.interpretation_note)?.test.interpretation_note;
    const band = rows.map(r => r.ranges[0]?.band_text).find(Boolean);
    return (
      <>
        {band && <div className="mt-1 text-[10px] text-gray-800 whitespace-pre-line">{band}</div>}
        {note && (
          <div className="mt-2 border border-gray-700 px-2.5 py-1.5 text-[9.5px] text-gray-900 leading-[1.5] whitespace-pre-line">
            {note}
          </div>
        )}
      </>
    );
  };

  async function withLog(channel: 'print' | 'pdf' | 'whatsapp_semi' | 'whatsapp_api' | 'email' | 'sms', target: string, key: string, fn: () => Promise<void> | void) {
    setBusy(key);
    try {
      await fn();
      await logDelivery(pid, channel, target, 'sent');
      setSent(s => ({ ...s, [key]: true }));
    } catch (err) {
      await logDelivery(pid, channel, target, 'failed', String(err));
      alert(String(err));
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
        alert(`PDF saved:\n${path}`);
      }
    });
  }

  function handleWhatsApp() {
    if (!patient?.phone) return;
    const msg = buildWhatsAppMessage({
      title: patient.title, name: patient.name, tests: panelSummary(),
      technicianName: settings.technician_name ?? 'Rajesh Kumar (Vicky)',
      technicianQual: settings.technician_qual ?? 'DMLT',
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
        alert('Report PDF sent automatically on WhatsApp.');
      });
      return;
    }
    // Semi-automatic fallback (free, dad's number): copy the PDF to the clipboard and open
    // the chat with the text ready — the user just pastes (Ctrl/⌘+V) and presses Enter.
    withLog('whatsapp_semi', `91${patient.phone}`, 'whatsapp', async () => {
      const pdfPath = (await makePdf()) || undefined;
      const { copyPdfToClipboard } = await import('@/lib/whatsapp');
      if (pdfPath) await copyPdfToClipboard(pdfPath);
      await sendWhatsAppSemi(patient.phone, msg, pdfPath);
      if (pdfPath) {
        alert(
          'WhatsApp chat opened and the report PDF is on the clipboard.\n\n' +
          '1. Click into the chat\n' +
          '2. Press Ctrl + V  (⌘ + V on Mac) to paste the PDF\n' +
          '3. Press Enter to send.\n\n' +
          '(If paste doesn’t attach it, use the “+” button → Document → the highlighted file.)'
        );
      }
    });
  }

  function handleSms() {
    if (!patient?.phone) { alert('This patient has no mobile number on file.'); return; }
    if (!settings.sms_api_key || !settings.sms_sender_id) {
      alert('SMS is not set up yet. Go to Settings → SMS and enter your gateway API key, Sender ID and DLT template.');
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
        message: buildSmsMessage({ name: patientName, testNo: patient.test_no }),
        vars: [patientName, String(patient.test_no)],
      });
      alert('SMS sent.');
    });
  }

  // Core email send (no UI side-effects) — shared by the manual button and auto-on-approve.
  async function emailCore(): Promise<void> {
    const host = settings.smtp_host, port = settings.smtp_port, user = settings.smtp_user, pass = settings.smtp_pass;
    const pdfPath = (await makePdf()) || null;   // "" (browser) → null so we don't attach a missing file
    const tech = settings.technician_name ?? 'Rajesh Kumar (Vicky)';
    const bodyHtml = `<div style="font-family:Inter,Arial,sans-serif;color:#1a1a1e">
      <p>Dear ${patient!.title} ${patient!.name},</p>
      <p>Please find attached your laboratory report (${panelSummary()}) from
      <b style="color:#7b1b1b">Sharma Clinical Laboratory</b>, Nangal Bhur, Pathankot.</p>
      <p style="color:#6b7280;font-size:13px">This is a computer-generated report. For queries, contact the laboratory.</p>
      <p style="margin-top:18px">— ${tech}<br/>${settings.technician_qual ?? 'DMLT (PTU)'}</p>
    </div>`;
    await sendEmail({
      host, port: parseInt(port, 10) || 587, username: user, password: pass,
      to: patient!.email!, subject: `Lab Report — ${patient!.title} ${patient!.name} (#${patient!.test_no})`,
      bodyHtml, pdfPath,
    });
  }

  function handleEmail() {
    if (!patient?.email) { alert('This patient has no email address on file.'); return; }
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      alert('Email is not set up yet. Go to Settings → Email and enter the lab Gmail address + app password.');
      return;
    }
    withLog('email', patient.email, 'email', async () => {
      await emailCore();
      alert('Email sent successfully.');
    });
  }

  if (!patient) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  const genderLabel = patient.sex === 'MALE' ? 'Male' : patient.sex === 'FEMALE' ? 'Female' : 'Other';

  return (
    <div className="flex gap-6">
      {/* ── Preview pane ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back to Results
          </button>
          <div className="flex items-center gap-2 text-gray-500">
            <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1.5 rounded hover:bg-gray-100"><ZoomOut size={15} /></button>
            <span className="text-xs w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(150, z + 25))} className="p-1.5 rounded hover:bg-gray-100"><ZoomIn size={15} /></button>
          </div>
        </div>

        <div className="overflow-auto pb-8">
          <div style={{ width: `${zoom}%`, transformOrigin: 'top left' }} className="mx-auto">
            <div
              id="report-print-area"
              className={cn("report-sheet bg-white mx-auto shadow-sm relative", !printLetterhead && "no-letterhead")}
              style={{ width: '210mm', minHeight: '297mm', padding: '12mm', fontFamily: '"Helvetica Neue", Arial, "Liberation Sans", system-ui, sans-serif', color: '#111', WebkitFontSmoothing: 'antialiased', ['--pre-top' as string]: `${preTop}mm`, ['--pre-bottom' as string]: `${preBottom}mm` }}
            >
              {showWatermark && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
                  <span style={{ transform: 'rotate(-35deg)', fontSize: '46px', color: 'rgba(123,27,27,0.05)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    SHARMA CLINICAL LABORATORY
                  </span>
                </div>
              )}

              {/* Header — faithful to the SCL letterhead */}
              <header className="report-letterhead relative">
                <div className="flex items-start gap-3">
                  {settings.logo_data
                    ? <img src={settings.logo_data} alt="SCL" className="h-[58px] w-auto object-contain shrink-0" />
                    : <SCLLogo height={44} className="shrink-0 mt-1" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h1 className="report-title text-[#7b1b1b]">SHARMA CLINICAL LABORATORY</h1>
                      <p className="text-right text-[10.5px] font-bold text-gray-900 leading-tight pt-1 max-w-[210px]">
                        {settings.address_line ?? 'G.T. ROAD, VILLAGE NANGAL BHUR, TEH. & DISTT. PATHANKOT'}
                      </p>
                    </div>
                    <div className="inline-block border border-gray-800 rounded px-2 py-[1px] mt-0.5 text-[10px] font-bold tracking-wide text-gray-900">
                      FULLY COMPUTERISED HI-TECH LAB.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 items-start mt-1.5 text-[10.5px] text-gray-900">
                  <p className="font-bold text-[#7b1b1b] leading-snug">
                    Mob : {(settings.phones ?? '9646778583 / 9464148746').replace(/^\s*mob\s*:?\s*/i, '')}
                  </p>
                  <p className="text-center leading-snug">{settings.timings ?? 'Timing : Summer - 7:30 am to 9:00 pm / Winter - 8:15 am to 7:30 pm'}</p>
                  <div className="text-right leading-tight">
                    <p className="report-script text-[#7b1b1b] text-[15px]">{settings.technician_name ?? 'Rajesh Kumar (Vicky)'}</p>
                    <p className="text-[10px]">{settings.technician_qual ?? 'DMLT (PTU)'}</p>
                  </div>
                </div>

                <div className="mt-1 text-[9.5px] font-bold text-gray-900 text-center leading-snug border-t-[3px] border-b-[3px] border-[#7b1b1b] border-double py-1">
                  Equipped With {(settings.equipment_line ?? 'ERBA H360 Blood Cell Counter, ERBA CHEM-5 PLUS Vz, EBRA Semi Auto Analyser, CHEM-7 & STAR 21 Semi Auto Analyser, Uri-plus 200 Urine Chemistry Analyser, Qua-lab Hba1c Analyser.').replace(/^\s*equipped with\s*/i, '')}
                </div>
              </header>

              <div className="report-body relative">
              {/* Patient block */}
              <section className="relative grid grid-cols-2 gap-x-8 gap-y-1 border border-gray-400 mt-3 p-3 text-[12px]">
                <p><strong>Name :</strong> {patient.title} {patient.name}</p>
                <p><strong>Test Request ID :</strong> {patient.test_no}</p>
                <p><strong>Age/Gender :</strong> {patient.age} {patient.age_unit} / {genderLabel}</p>
                <p><strong>Sample Collected ON :</strong> {formatDate(patient.sample_time)}</p>
                <p><strong>Collected AT :</strong> {patient.collected_at}</p>
                <p><strong>Sample Received ON :</strong> {formatDate(patient.sample_time)}</p>
                <p><strong>Referred By :</strong> {patient.doctor_name ?? 'SELF'}</p>
                <p><strong>Report DATE :</strong> {formatDate(patient.report_time)}</p>
              </section>

              {/* Results — each test profile prints on its own page */}
              <section className="relative mt-3">
                {sortedPanels.map(({ panel, orders: rows }, idx) => {
                  const dept = deptOf(panel);
                  return (
                    <div key={panel.code} style={idx < sortedPanels.length - 1 ? { breakAfter: 'page' } : undefined} className="mb-4">
                      <div className="text-center font-bold text-[13.5px] tracking-wide text-black underline underline-offset-2 mb-1">{dept}</div>
                      {panel.report_heading !== dept && (
                        <div className="text-center font-semibold text-[12px] text-black mb-1.5">{panel.report_heading}</div>
                      )}
                      <table className="w-full text-[12px] border-collapse">
                        {renderHead()}
                        <tbody>{renderRows(rows)}</tbody>
                      </table>
                      {renderNotes(rows)}
                      {panel.code === 'CBC' && <HistogramRow histos={histograms} />}
                    </div>
                  );
                })}

                {comment && (
                  <div className="mt-2 text-[11px]"><strong>Comments :</strong> {comment}</div>
                )}
              </section>
              </div>{/* /report-body */}

              {/* Footer */}
              <footer className="report-letterfoot relative mt-6 pt-2 border-t border-gray-400">
                <div className="flex justify-between items-end">
                  {qr ? <img src={qr} alt="QR" width={70} height={70} className="opacity-90" /> : <span />}
                  {showSignature && (
                    <div className="text-center">
                      {settings.signature_data
                        ? <img src={settings.signature_data} alt="signature" className="h-14 mx-auto object-contain" />
                        : <div className="h-14 w-32 flex items-end justify-center text-gray-300 text-[10px] italic">[ upload signature in Settings ]</div>}
                      <p className="text-[11px] font-bold text-[#7b1b1b] underline underline-offset-2 mt-0.5">Lab Technician</p>
                    </div>
                  )}
                </div>
                <div className="text-center text-[12px] font-bold mt-2">*** End Of Report ***</div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>NOT FOR MEDICO LEGAL PURPOSE</span>
                  <span>ALL TEST ARE AVAILABLE HERE</span>
                </div>
                <div className="text-center text-[9px] text-gray-500 mt-1 leading-tight">
                  {settings.footer_tests_line ?? "T3, T4, TSH (THYROID), LH, FSH, PROLACTIN, TESTOSTERONE, ESTRADIOL, LFT, LIPID PROFILE, KIDNEY FUNCTION TEST'S CULTURES, MALARIA ANTIGEN, TYPHOID ANTIBODIES TESTS AVAILABLES"}
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action panel ── */}
      <aside className="w-[252px] shrink-0 space-y-4 pt-4 print:hidden">
        <div className="card p-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-1">Deliver</p>
          {!isApproved && (
            <p className="text-[12px] text-[#92600a] bg-[#fdf0d7] rounded-lg px-3 py-2 leading-snug">
              Approve the report first to enable delivery.
            </p>
          )}
          <OutputBtn icon={Printer} label="Print" onClick={handlePrint} done={sent.print} disabled={!isApproved} busy={busy === 'print'} primary />
          <OutputBtn icon={FileDown} label="Save PDF" onClick={handlePdf} done={sent.pdf} disabled={!isApproved} busy={busy === 'pdf'} />
          <OutputBtn icon={MessageCircle} label="WhatsApp" onClick={handleWhatsApp} done={sent.whatsapp} disabled={!isApproved || !patient.phone} busy={busy === 'whatsapp'} green />
          <OutputBtn icon={Mail} label="Email" onClick={handleEmail} done={sent.email} disabled={!isApproved || !patient.email} busy={busy === 'email'} />
          <OutputBtn icon={Smartphone} label="SMS" onClick={handleSms} done={sent.sms} disabled={!isApproved || !patient.phone} busy={busy === 'sms'} />
        </div>

        <div className="card p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d]">Layout</p>
          <Toggle label="Print lab letterhead" checked={printLetterhead} onChange={(v) => { setPrintLetterhead(v); localStorage.setItem('scl_print_letterhead', v ? '1' : '0'); }} />
          {!printLetterhead && (
            <div className="rounded-lg bg-[#f1efec] px-3 py-2.5 space-y-2">
              <p className="text-[10.5px] text-[#6b6259] leading-snug">
                Letterhead hidden for printing on your pre-printed paper. Adjust the gaps so the data lands inside the printed frame.
              </p>
              <GapInput label="Top gap" value={preTop} onChange={(v) => { setPreTop(v); localStorage.setItem('scl_pre_top', String(v)); }} />
              <GapInput label="Bottom gap" value={preBottom} onChange={(v) => { setPreBottom(v); localStorage.setItem('scl_pre_bottom', String(v)); }} />
            </div>
          )}
          <Toggle label="Signature" checked={showSignature} onChange={setShowSignature} />
          <Toggle label="Watermark" checked={showWatermark} onChange={setShowWatermark} />
        </div>

        {bill && (
          <div className="card p-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-1">Billing</p>
            <Row k="Total" v={`₹${bill.total}`} />
            {bill.concession > 0 && <Row k="Concession" v={`− ₹${bill.concession}`} />}
            {bill.concession > 0 && <Row k="Amount" v={`₹${bill.net}`} />}
          </div>
        )}
      </aside>
    </div>
  );
}

function OutputBtn({ icon: Icon, label, onClick, done, disabled, busy, primary, green }: {
  icon: typeof Printer; label: string; onClick: () => void; done?: boolean; disabled?: boolean; busy?: boolean; primary?: boolean; green?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled || busy} title={disabled ? 'Approve the report first' : undefined}
      className={cn("w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        green ? "bg-green-600 text-white hover:bg-green-700"
          : primary ? "bg-[#7b1b1b] text-white hover:bg-[#6a1717]"
            : "border border-gray-300 text-gray-700 hover:bg-gray-50")}>
      <Icon size={16} /> {busy ? '…' : label} {done && <Check size={13} className={green || primary ? 'text-white' : 'text-green-600'} />}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-gray-600">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={cn("w-9 h-5 rounded-full transition-colors relative", checked ? "bg-[#7b1b1b]" : "bg-gray-300")}>
        <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all", checked ? "left-4" : "left-0.5")} />
      </button>
    </label>
  );
}

function GapInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between text-[11.5px] text-[#6b6259]">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number" min={0} max={120} value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(120, Number(e.target.value) || 0)))}
          className="w-14 rounded border border-[#d8d3cc] bg-white px-2 py-1 text-right tabular-nums"
        />
        <span className="text-[#a8a29b]">mm</span>
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
