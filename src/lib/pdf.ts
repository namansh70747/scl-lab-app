import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { documentDir, join } from "@tauri-apps/api/path";
import { invoke, isTauri } from "@/lib/tauri";
import { parseDbDate } from "@/lib/format";

/** Rasterise the on-screen report element into a multi-page A4 PDF and return it
 *  as a jsPDF document. The SAME DOM that is shown/printed is captured, so paper,
 *  preview and PDF are guaranteed identical (§8.7). */
async function renderReportPdf(el: HTMLElement): Promise<jsPDF> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();   // 297
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  const img = canvas.toDataURL("image/jpeg", 0.95);
  let remaining = imgH;
  let position = 0;
  pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
  // Half-mm tolerance: when content lands exactly on a 297mm boundary, float error
  // would otherwise leave a sliver > 0 and append a blank trailing page.
  remaining -= pageH;
  while (remaining > 0.5) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    remaining -= pageH;
  }
  return pdf;
}

function safeName(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "report";
}

/**
 * Print path that works reliably inside the Tauri webview (where window.print() is a
 * no-op on macOS): render the report EXACTLY as shown (honouring the letterhead toggle,
 * so pre-printed paper gets the headerless layout), save it to a temp file, and open it
 * in the OS's default PDF viewer where the user presses Ctrl/⌘+P to print to the attached
 * printer. In a plain browser it falls back to window.print().
 */
/** Build a one-page alignment test sheet and open it for printing (no popup needed). */
export async function openPrintTestPage(printerName: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFontSize(16);
  pdf.setTextColor(123, 27, 27);
  pdf.text("SHARMA CLINICAL LABORATORY — Print test page", 12, 20);
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Target printer: ${printerName || "system default"}`, 12, 30);
  pdf.text("If this prints cleanly with ~12 mm margins, the report layout will too.", 12, 38);
  pdf.rect(12, 48, 186, 18);
  pdf.text("Margins / alignment check — text should sit ~12 mm from each edge.", 16, 58);
  if (!isTauri()) {
    window.open(pdf.output("bloburl"), "_blank");
    return;
  }
  const docDir = await documentDir();
  const outPath = await join(docDir, "SCL Reports", "_print", "test-page.pdf");
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.substring(dataUri.indexOf(",") + 1);
  await invoke<string>("save_pdf_bytes", { base64Data: base64, outPath });
  await invoke("open_path", { path: outPath });   // open in default PDF viewer (shell scope blocks file paths)
}

export async function printReportPdf(opts: { element: HTMLElement; testNo: number; name: string }): Promise<void> {
  if (!isTauri()) {
    window.print();
    return;
  }
  const pdf = await renderReportPdf(opts.element);   // as-shown — respects the no-letterhead toggle
  const docDir = await documentDir();
  const outPath = await join(docDir, "SCL Reports", "_print", `${opts.testNo}-${safeName(opts.name)}.pdf`);
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.substring(dataUri.indexOf(",") + 1);
  await invoke<string>("save_pdf_bytes", { base64Data: base64, outPath });
  await invoke("open_path", { path: outPath });   // opens in the default PDF viewer → user prints to the connected printer
}

/**
 * Generate the report PDF and save it under Documents/SCL Reports/YYYY/MM/.
 * Returns the absolute saved path. In a plain browser (no Tauri) it triggers a
 * normal download and returns "".
 */
export async function saveReportPdf(opts: {
  element: HTMLElement;
  testNo: number;
  name: string;
  reportDate?: string | null;
}): Promise<string> {
  const pdf = await renderReportPdf(opts.element);
  const fileName = `${opts.testNo}-${safeName(opts.name)}.pdf`;

  if (!isTauri()) {
    pdf.save(fileName);
    return "";
  }

  let d = opts.reportDate ? parseDbDate(opts.reportDate) : new Date();
  if (isNaN(d.getTime())) d = new Date();   // fall back to today, never an empty path segment
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  const docDir = await documentDir();
  const outPath = await join(docDir, "SCL Reports", yyyy, mm, fileName);

  // jsPDF → base64 (strip the data: prefix) → Rust writes the file.
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.substring(dataUri.indexOf(",") + 1);
  return invoke<string>("save_pdf_bytes", { base64Data: base64, outPath });
}
