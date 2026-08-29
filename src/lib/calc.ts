// All derived value formulas for calculated tests
// Returns null if inputs unavailable (blank on report, never NaN)

export type ResultMap = Record<string, number | string | null>;

/** Codes hardwired in the switch — editing their `formula` column has no effect on computation. */
export const BUILTIN_CALC_CODES = new Set([
  'BBI', 'GLO', 'BAG', 'BBI1', 'GLO1', 'BAG1',
  'BIL1_I', 'BIL2_I',
  'BVLDL', 'NHDL', 'BLDL', 'BRAT', 'BLHR',
  'EAG', 'BUN', 'INR', 'GFR', 'GFR_CAT',
]);

/** Extract all identifier tokens from a formula (same regex the evaluator uses). */
export function extractCodes(formula: string): string[] {
  return Array.from(formula.matchAll(/[A-Za-z][A-Za-z0-9_]*/g), m => m[0]);
}

/** Validate a formula string against a set of known test codes. Returns human-readable errors. */
export function validateFormula(
  formula: string,
  knownCodes: Set<string>
): { ok: boolean; error?: string; codes: string[] } {
  const trimmed = formula.trim();
  if (!trimmed) return { ok: false, error: 'Formula is empty', codes: [] };

  const illegalMatch = trimmed.match(/[^A-Za-z0-9_.() +\-*/%\t]/);
  if (illegalMatch) {
    return { ok: false, error: `Invalid character: "${illegalMatch[0]}"`, codes: [] };
  }

  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) return { ok: false, error: "A closing bracket has no matching open bracket", codes: [] };
  }
  if (depth > 0) return { ok: false, error: "A bracket isn't closed", codes: [] };

  if (/[+\-*/(]\s*$/.test(trimmed)) {
    return { ok: false, error: 'Formula ends with an operator', codes: [] };
  }

  const codes = extractCodes(trimmed);
  for (const code of codes) {
    if (!knownCodes.has(code)) {
      return { ok: false, error: `Unknown test code: ${code}`, codes };
    }
  }

  return { ok: true, codes };
}

/** Run the real formula engine with sample values and return a formatted string for preview. */
export function previewFormula(
  formula: string,
  sample: Record<string, number>,
  decimals: number
): string {
  const result = computeCalculated('__preview__', formula, sample);
  if (result == null) return '—';
  if (typeof result === 'number') return formatResult(result, decimals);
  return String(result);
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

function safeNum(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

/** Patient context some calculated tests need (e.g. eGFR uses age + sex). */
export interface CalcContext {
  ageYears?: number;
  sex?: 'MALE' | 'FEMALE' | 'OTHER';
}

export function computeCalculated(code: string, formula: string, values: ResultMap, ctx?: CalcContext): number | string | null {
  const g = (c: string) => { const v = values[c]; return typeof v === 'number' ? v : null; };

  switch (code) {
    case 'BBI': {
      const bbt = g('BBT'), bbd = g('BBD');
      if (bbt == null || bbd == null) return null;
      return Math.max(0, bbt - bbd);
    }
    case 'GLO': {
      const tpn = g('TPN'), alb = g('ALB');
      if (tpn == null || alb == null) return null;
      return tpn - alb;
    }
    case 'BAG': return safeDiv(g('ALB'), g('GLO'));
    // "…1" twins of the LFT bilirubin/protein calcs — these tests live in the BIOCHEMISTRY panel
    // (see migration 0049) and compute from their own "…1" inputs so they behave identically to
    // the natives (e.g. indirect bilirubin clamped at 0).
    case 'BBI1': {
      const bbt = g('BBT1'), bbd = g('BBD1');
      if (bbt == null || bbd == null) return null;
      return Math.max(0, bbt - bbd);
    }
    case 'GLO1': {
      const tpn = g('TPN1'), alb = g('ALB1');
      if (tpn == null || alb == null) return null;
      return tpn - alb;
    }
    case 'BAG1': return safeDiv(g('ALB1'), g('GLO1'));
    // Standalone "Bilirubin (Total, Direct & Indirect)" combo panels — BIL1_* reports under the
    // LFT heading, BIL2_* under BIOCHEMISTRY. Indirect is clamped at 0 exactly like BBI/BBI1.
    case 'BIL1_I': {
      const bbt = g('BIL1_T'), bbd = g('BIL1_D');
      if (bbt == null || bbd == null) return null;
      return Math.max(0, bbt - bbd);
    }
    case 'BIL2_I': {
      const bbt = g('BIL2_T'), bbd = g('BIL2_D');
      if (bbt == null || bbd == null) return null;
      return Math.max(0, bbt - bbd);
    }
    case 'BVLDL': {
      const tg = g('TG');
      return tg != null ? tg / 5 : null;
    }
    case 'NHDL': {
      const chol = g('CHOL'), hdl = g('BHDL');
      if (chol == null || hdl == null) return null;
      return chol - hdl;
    }
    case 'BLDL': {
      const chol = g('CHOL'), hdl = g('BHDL'), tg = g('TG');
      if (chol == null || hdl == null || tg == null) return null;
      // LDL = Total − HDL − VLDL(=TG/5). Computed for ALL triglyceride levels so it never blanks
      // out on a raised lipid profile — consistent with VLDL and Non-HDL, which already compute
      // regardless. (At very high TG the calculated value is less reliable than a direct LDL; the
      // interpretation note covers that, but the lab wants the number shown.)
      return chol - hdl - tg / 5;
    }
    case 'BRAT': return safeDiv(g('CHOL'), g('BHDL'));
    case 'BLHR': return safeDiv(g('BLDL'), g('BHDL'));
    case 'EAG': {
      const hba1c = g('HBA1C');
      return hba1c != null ? 28.7 * hba1c - 46.7 : null;
    }
    case 'BUN': {
      const urea = g('UREA');
      return urea != null ? urea * 0.467 : null;
    }
    case 'INR': {
      // INR = (PT patient / PT control) ^ ISI — the WHO/ICSH definition. The exponent is the
      // reagent's International Sensitivity Index, so a lab whose thromboplastin is not ISI 1.0
      // gets a materially different INR; ignoring it (the old PT/12 shortcut) reported the plain
      // ratio against a fixed 12 s control and was wrong on both counts.
      //
      // Inputs come from the PT/INR panel (PTIT patient, PTICT control, ISI reagent index). The
      // legacy standalone coagulation test PT_PT has no control or ISI line of its own, so it
      // keeps its historical assumptions (12 s control, ISI 1) and its value is unchanged.
      const pt = g('PTIT') ?? g('PT_PT');
      const control = g('PTICT') ?? 12.0;
      const isi = g('ISI') ?? 1.0;
      if (pt == null || pt <= 0 || control <= 0) return null;
      const inr = Math.pow(pt / control, isi);
      return isFinite(inr) ? inr : null;
    }
    case 'GFR': {
      // CKD-EPI 2021 — needs serum creatinine (CRT) + patient age + sex.
      const crt = g('CRT');
      if (crt == null || crt <= 0 || !ctx?.ageYears || ctx.ageYears <= 0) return null;
      return computeGFR(crt, ctx.ageYears, ctx.sex === 'FEMALE' ? 'FEMALE' : 'MALE');
    }
    case 'GFR_CAT': {
      const gfr = g('GFR');
      if (gfr == null) return null;
      if (gfr >= 90) return 'G1 — Normal / High';
      if (gfr >= 60) return 'G2 — Mildly Decreased';
      if (gfr >= 45) return 'G3a — Mildly to Moderately Decreased';
      if (gfr >= 30) return 'G3b — Moderately to Severely Decreased';
      if (gfr >= 15) return 'G4 — Severely Decreased';
      return 'G5 — Kidney Failure';
    }
    default: {
      // Try to evaluate a simple formula like "BBT - BBD" or "28.7 * HBA1C - 46.7".
      // Codes may contain digits/underscores (HBA1C, PT_PT), so a token must start with a
      // letter and may continue with letters, digits or underscores.
      try {
        if (!formula) return null;
        const replaced = formula.replace(/[A-Za-z][A-Za-z0-9_]*/g, (match) => {
          const v = values[match];
          return v != null ? String(v) : 'null';
        });
        if (replaced.includes('null')) return null;
        // Safe eval for simple arithmetic only
        const result = Function(`"use strict"; return (${replaced})`)();
        return typeof result === 'number' && isFinite(result) ? result : null;
      } catch {
        return null;
      }
    }
  }
}

/**
 * Fold all calculated values back into the value map so formulas that depend on
 * other calculated values resolve instead of staying blank. Example chains:
 *   GLO = TPN − ALB  →  A/G ratio = ALB / GLO   (BAG depends on GLO)
 *   LDL = Friedewald →  LDL/HDL ratio = LDL / HDL (BLHR depends on BLDL)
 * Without this, the dependent ratio is always blank because only *entered* values
 * are seeded into the map. Iterates to a fixed point (bounded by the test count).
 */
export function resolveCalculated(
  base: ResultMap,
  calculated: { code: string; formula: string | null }[],
  ctx?: CalcContext
): ResultMap {
  const values: ResultMap = { ...base };
  for (let pass = 0; pass <= calculated.length; pass++) {
    let changed = false;
    for (const t of calculated) {
      if (values[t.code] != null) continue;          // already known (entered or computed)
      const v = computeCalculated(t.code, t.formula ?? '', values, ctx);
      if (v != null) { values[t.code] = v; changed = true; }
    }
    if (!changed) break;
  }
  return values;
}

export function computeGFR(creatinine: number, ageYears: number, sex: 'MALE' | 'FEMALE'): number | null {
  if (creatinine <= 0 || ageYears <= 0) return null;
  // CKD-EPI 2021
  const kappa = sex === 'FEMALE' ? 0.7 : 0.9;
  const alpha = sex === 'FEMALE' ? -0.241 : -0.302;
  const sexFactor = sex === 'FEMALE' ? 1.012 : 1.0;
  const ratio = creatinine / kappa;
  const gfr = 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.200)
    * Math.pow(0.9938, ageYears) * sexFactor;
  return Math.round(gfr);
}

/** Clamp to the range toFixed/Math.pow can safely handle — a stray negative or huge
 *  `decimals` (bad data) would otherwise throw a RangeError and crash report rendering. */
export function safeDecimals(decimals: number): number {
  if (!Number.isFinite(decimals)) return 0;
  return Math.min(10, Math.max(0, Math.trunc(decimals)));
}

export function roundToDecimals(value: number, decimals: number): number {
  const d = safeDecimals(decimals);
  const factor = Math.pow(10, d);
  return Math.round(value * factor) / factor;
}

export function formatResult(value: number | null, decimals: number): string {
  if (value == null) return '';
  const d = safeDecimals(decimals);
  return roundToDecimals(value, d).toFixed(d);
}

export { safeNum };
