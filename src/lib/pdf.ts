import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { documentDir, join } from "@tauri-apps/api/path";
import { invoke, isTauri } from "@/lib/tauri";

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
  remaining -= pageH;
  while (remaining > 0) {
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

  let d = opts.reportDate ? new Date(opts.reportDate) : new Date();
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
