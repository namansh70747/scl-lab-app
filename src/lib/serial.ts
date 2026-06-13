import { invoke, isTauri } from "@/lib/tauri";
import { parseAnalyzer, type AnalyzerReading } from "@/lib/astm";

/** List the serial ports the OS can see (for the Analyzer settings dropdown). */
export async function listSerialPorts(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("serial_list_ports");
}

/** This PC's LAN IP(s) — shown in Settings → Analyzer so the user knows the H360 "Host IP". */
export async function localIps(): Promise<string[]> {
  if (!isTauri()) return [];
  try { return await invoke<string[]>("local_ips"); } catch { return []; }
}

/** Read raw text from the analyzer's serial port within a time window. */
export async function readSerialRaw(port: string, baud: number, windowMs = 6000): Promise<string> {
  if (!isTauri()) throw new Error("Serial reading is only available in the desktop app.");
  if (!port) throw new Error("No analyzer port selected. Set it in Settings → Analyzer.");
  return invoke<string>("serial_read", { port, baud, windowMs });
}

/** Read the analyzer and parse it into structured values + histograms. */
export async function readAnalyzer(port: string, baud: number, windowMs = 6000): Promise<AnalyzerReading> {
  const raw = await readSerialRaw(port, baud, windowMs);
  return parseAnalyzer(raw);
}

/** Read raw text from the analyzer over the network (TCP/IP). */
export async function readTcpRaw(mode: string, host: string, port: number, windowMs = 15000): Promise<string> {
  if (!isTauri()) throw new Error('Network reading is only available in the desktop app.');
  return invoke<string>('tcp_capture', { mode, host, port, windowMs });
}

/**
 * Read the analyzer using whatever connection is configured in Settings → Analyzer,
 * and parse it. Network (TCP/IP) is the ERBA H360's normal mode; serial is the fallback.
 */
export async function readAnalyzerConfigured(s: Record<string, string>): Promise<AnalyzerReading> {
  if ((s.analyzer_conn ?? 'network') === 'network') {
    const raw = await readTcpRaw(
      s.analyzer_tcp_mode || 'listen',
      s.analyzer_host || '',
      Number(s.analyzer_tcp_port || '5000'),
      // Wide window: the operator clicks "Read", walks to the H360 and presses transmit.
      60000,
    );
    return parseAnalyzer(raw);
  }
  return readAnalyzer(s.analyzer_port || '', Number(s.analyzer_baud || '9600'), 20000);
}
