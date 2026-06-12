import { invoke, isTauri } from "@/lib/tauri";
import { parseAnalyzer, type AnalyzerReading } from "@/lib/astm";

/** List the serial ports the OS can see (for the Analyzer settings dropdown). */
export async function listSerialPorts(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("serial_list_ports");
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
