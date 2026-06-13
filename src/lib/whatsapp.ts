import { open } from '@tauri-apps/plugin-shell';
import { revealInFolder } from '@/lib/printing';
import { invoke, isTauri } from '@/lib/tauri';

export interface WaMessageInput {
  title: string;
  name: string;
  tests: string;
  technicianName: string;
  technicianQual: string;
}

export function buildWhatsAppMessage(i: WaMessageInput): string {
  const testList = i.tests.length > 90 ? i.tests.slice(0, 90) + '…' : i.tests;
  return `Dear ${i.title} ${i.name}, your lab report (${testList}) from SHARMA CLINICAL LABORATORY, Nangal Bhur is ready. — ${i.technicianName}, ${i.technicianQual}`;
}

export interface WaDocArgs {
  token: string;
  phoneNumberId: string;
  to: string;          // 10-digit mobile; 91 is prefixed automatically
  pdfPath: string;
  filename: string;
  caption: string;
  apiVersion?: string;
}

/**
 * Fully-automatic delivery via the WhatsApp Business Cloud API: uploads the report PDF
 * and sends it as a document message. Requires a Cloud-API phone number + access token
 * (configured in Settings → WhatsApp) — NOT a personal WhatsApp number.
 */
export async function sendWhatsAppDocument(a: WaDocArgs): Promise<string> {
  const digits = a.to.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (digits.length !== 10) throw new Error(`"${a.to}" is not a valid 10-digit mobile number.`);
  if (!a.token || !a.phoneNumberId) throw new Error('WhatsApp Cloud API is not configured (token / phone number ID missing).');
  return invoke<string>('whatsapp_send_document', {
    token: a.token,
    phoneNumberId: a.phoneNumberId,
    to: `91${digits}`,
    pdfPath: a.pdfPath,
    filename: a.filename,
    caption: a.caption,
    apiVersion: a.apiVersion || 'v21.0',
  });
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

/** Put the report PDF on the clipboard so it can be pasted straight into WhatsApp. */
export async function copyPdfToClipboard(path: string): Promise<void> {
  if (!isTauri() || !path) return;
  await invoke<void>('copy_file_to_clipboard', { path });
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
