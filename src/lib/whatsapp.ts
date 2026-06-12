import { open } from '@tauri-apps/plugin-shell';
import { revealInFolder } from '@/lib/printing';
import { isTauri } from '@/lib/tauri';

export interface WaMessageInput {
  title: string;
  name: string;
  tests: string;
  technicianName: string;
  technicianQual: string;
}

export function buildWhatsAppMessage(i: WaMessageInput): string {
  const testList = i.tests.length > 90 ? i.tests.slice(0, 90) + '…' : i.tests;
  return `Dear ${i.title} ${i.name}, your lab report (${testList}) from SHARMA CLINICAL LABORATORY, Nangal Bhur is ready. The PDF report is attached below. — ${i.technicianName}, ${i.technicianQual}`;
}

/** Semi-automatic WhatsApp (§8A.8 / Phase 6): open wa.me prefilled, then reveal the
 *  saved PDF so the user drags it in once. Zero cost, zero ban risk. */
export async function sendWhatsAppSemi(phone: string, message: string, pdfPath?: string): Promise<void> {
  const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (digits.length !== 10) throw new Error(`"${phone}" is not a valid 10-digit mobile number.`);
  const url = `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
  if (isTauri()) {
    await open(url);
    if (pdfPath) await revealInFolder(pdfPath);
  } else {
    window.open(url, '_blank');
  }
}

export interface WaApiConfig {
  apiKey: string;
  templateName: string;
}

/** API mode is wired behind a Settings toggle; the BSP onboarding (Meta verification +
 *  approved utility template) is a deployment step. Until configured this throws a clear
 *  message so the UI can fall back to semi mode. */
export async function sendWhatsAppApi(_phone: string, _config: WaApiConfig): Promise<void> {
  throw new Error('WhatsApp API mode is not configured. Complete BSP onboarding in Settings → WhatsApp, or use semi-automatic mode.');
}
