// All derived value formulas for calculated tests
// Returns null if inputs unavailable (blank on report, never NaN)

export type ResultMap = Record<string, number | null>;

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

function safeNum(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

export function computeCalculated(code: string, formula: string, values: ResultMap): number | null {
  const g = (c: string) => values[c] ?? null;

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
      if (tg > 400) return null; // Friedewald invalid
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
      // INR = PT_patient / PT_control (control ≈ 12s), simplified
      const pt = g('PT_PT');
      return pt != null ? pt / 12.0 : null;
    }
    case 'GFR': return null; // Requires age/sex/creatinine - computed separately
    default: {
      // Try to evaluate simple formula like "BBT - BBD"
      try {
        if (!formula) return null;
        const replaced = formula.replace(/[A-Z_]+/g, (match) => {
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
  calculated: { code: string; formula: string | null }[]
): ResultMap {
  const values: ResultMap = { ...base };
  for (let pass = 0; pass <= calculated.length; pass++) {
    let changed = false;
    for (const t of calculated) {
      if (values[t.code] != null) continue;          // already known (entered or computed)
      const v = computeCalculated(t.code, t.formula ?? '', values);
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
