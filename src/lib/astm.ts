import type { OrderWithResult } from "@/types";

/**
 * Parser for the result stream sent by the ERBA H360 cell counter over serial.
 * The H360 transmits ASTM E1394 records (R| result lines); this also falls back to a
 * tolerant "LABEL value unit" line scan so a slightly different firmware dialect still
 * yields values. Use Settings → Analyzer → "Capture raw" to confirm the exact format
 * against your machine and tighten this if a parameter is missed.
 *
 * Nothing here writes to the database — the technician always reviews the parsed values
 * and confirms before they are applied to a patient (patient-safety).
 */

export interface AnalyzerValue {
  value: string;
  unit: string;
}

export interface AnalyzerHistograms {
  wbc?: number[];
  rbc?: number[];
  plt?: number[];
}

export interface AnalyzerReading {
  values: Record<string, AnalyzerValue>; // keyed by normalised parameter
  histograms: AnalyzerHistograms;
  raw: string;
}

/** Normalise a parameter label so "LYM%", "lym %", "RDW-SD" compare cleanly. */
export function normKey(s: string): string {
  return s
    .toUpperCase()
    .replace(/%/g, "PCT")
    .replace(/#/g, "NUM")
    .replace(/[^A-Z0-9]/g, "");
}

/** ERBA H360 labels that should also fill the simple HEMATOLOGY panel codes. */
const ALIASES: Record<string, string[]> = {
  HB: ["HGB"],
  TLC: ["WBC"],
  PLT: ["PLT"],
  PCV: ["HCT"],
};

function parseHistograms(lines: string[]): AnalyzerHistograms {
  const histos: AnalyzerHistograms = {};
  for (const line of lines) {
    const upper = line.toUpperCase();
    // A long run of numbers (the distribution curve) tagged with the channel name.
    const nums = (line.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (nums.length < 32) continue;
    if (upper.includes("WBC")) histos.wbc = nums;
    else if (upper.includes("RBC")) histos.rbc = nums;
    else if (upper.includes("PLT") || upper.includes("PLATELET")) histos.plt = nums;
  }
  return histos;
}

export function parseAnalyzer(raw: string): AnalyzerReading {
  const lines = raw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const values: Record<string, AnalyzerValue> = {};

  let sawAstmResult = false;
  for (const line of lines) {
    // ASTM result record:  R|seq|^^^WBC|6.5|10^3/uL|...
    const fields = line.split("|");
    if (/^R$/i.test(fields[0]) && fields.length >= 4) {
      sawAstmResult = true;
      const id = (fields[2] ?? "").split("^").filter(Boolean).pop() ?? "";
      const value = (fields[3] ?? "").trim();
      const unit = (fields[4] ?? "").trim();
      if (id && value !== "" && !isNaN(Number(value))) {
        values[normKey(id)] = { value, unit };
      }
    }
  }

  if (!sawAstmResult) {
    // Fallback: "WBC 6.5 10^3/uL", "HGB: 13.4", "MCV=88.2 fL"
    for (const line of lines) {
      const m = /^([A-Za-z][A-Za-z0-9%#/\- ]{0,15}?)[\s:=]+(-?\d+(?:\.\d+)?)\s*([A-Za-z0-9%^/µ.]*)/.exec(line);
      if (m) {
        const key = normKey(m[1]);
        if (key) values[key] = { value: m[2], unit: (m[3] ?? "").trim() };
      }
    }
  }

  return { values, histograms: parseHistograms(lines), raw };
}

export interface AnalyzerMatch {
  orderId: number;
  code: string;
  testName: string;
  current: string;
  incoming: string;
  unit: string;
}

/** Match parsed analyzer values to this patient's orders (by test code/name + aliases). */
export function matchToOrders(
  reading: AnalyzerReading,
  orders: OrderWithResult[],
  currentValues: Record<number, string>,
): AnalyzerMatch[] {
  const matches: AnalyzerMatch[] = [];
  for (const o of orders) {
    if (o.test.is_panel || o.order.not_done) continue;
    if (o.test.result_type === "calculated") continue;
    const keys = new Set<string>([normKey(o.test.code), normKey(o.test.name)]);
    for (const a of ALIASES[o.test.code] ?? []) keys.add(normKey(a));

    let hit: AnalyzerValue | undefined;
    for (const k of keys) {
      if (reading.values[k]) { hit = reading.values[k]; break; }
    }
    if (!hit) continue;
    matches.push({
      orderId: o.order.id,
      code: o.test.code,
      testName: o.test.name,
      current: currentValues[o.order.id] ?? o.result?.value ?? "",
      incoming: hit.value,
      unit: hit.unit || o.test.unit,
    });
  }
  return matches;
}
