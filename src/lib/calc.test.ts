import { describe, it, expect } from 'vitest';
import {
  computeCalculated,
  resolveCalculated,
  computeGFR,
  roundToDecimals,
  formatResult,
  type ResultMap,
} from '@/lib/calc';

// Helper: most formulas key off `code`; `formula` string is unused for known codes.
const calc = (code: string, values: ResultMap) => computeCalculated(code, '', values);

describe('computeCalculated', () => {
  describe('BBI = max(0, BBT - BBD)', () => {
    it('computes difference', () => {
      expect(calc('BBI', { BBT: 1.2, BBD: 0.3 })).toBeCloseTo(0.9);
    });
    it('clamps to 0 when negative', () => {
      expect(calc('BBI', { BBT: 0.3, BBD: 1.0 })).toBe(0);
    });
    it('returns null when an input is missing', () => {
      expect(calc('BBI', { BBT: 1.2 })).toBeNull();
      expect(calc('BBI', { BBD: 0.3 })).toBeNull();
      expect(calc('BBI', {})).toBeNull();
    });
  });

  describe('GLO = TPN - ALB', () => {
    it('computes difference', () => {
      expect(calc('GLO', { TPN: 7.5, ALB: 4.0 })).toBeCloseTo(3.5);
    });
    it('returns null when an input is missing', () => {
      expect(calc('GLO', { TPN: 7.5 })).toBeNull();
      expect(calc('GLO', { ALB: 4.0 })).toBeNull();
    });
  });

  describe('BAG = ALB / GLO', () => {
    it('computes ratio', () => {
      expect(calc('BAG', { ALB: 4.0, GLO: 2.0 })).toBeCloseTo(2.0);
    });
    it('returns null on division by zero (never NaN)', () => {
      const v = calc('BAG', { ALB: 4.0, GLO: 0 });
      expect(v).toBeNull();
      expect(Number.isNaN(v as number)).toBe(false);
    });
    it('returns null when missing', () => {
      expect(calc('BAG', { ALB: 4.0 })).toBeNull();
      expect(calc('BAG', { GLO: 2.0 })).toBeNull();
    });
  });

  // The "…1" twins live in the BIOCHEMISTRY panel (migration 0049) and must behave identically
  // to their LFT natives, computing from their own "…1" inputs.
  describe('biochemistry "…1" duplicate calcs', () => {
    it('BBI1 = max(0, BBT1 - BBD1) and clamps to 0', () => {
      expect(calc('BBI1', { BBT1: 1.2, BBD1: 0.3 })).toBeCloseTo(0.9);
      expect(calc('BBI1', { BBT1: 0.3, BBD1: 1.0 })).toBe(0);
      expect(calc('BBI1', { BBT1: 1.2 })).toBeNull();
    });
    it('GLO1 = TPN1 - ALB1', () => {
      expect(calc('GLO1', { TPN1: 7.5, ALB1: 4.0 })).toBeCloseTo(3.5);
      expect(calc('GLO1', { ALB1: 4.0 })).toBeNull();
    });
    it('BAG1 = ALB1 / GLO1, null (not NaN) on division by zero', () => {
      expect(calc('BAG1', { ALB1: 4.0, GLO1: 2.0 })).toBeCloseTo(2.0);
      const v = calc('BAG1', { ALB1: 4.0, GLO1: 0 });
      expect(v).toBeNull();
      expect(Number.isNaN(v as number)).toBe(false);
    });
    it('resolves the GLO1 → BAG1 chain from entered TPN1 / ALB1', () => {
      const out = resolveCalculated(
        { TPN1: 7.0, ALB1: 4.0 },
        [
          { code: 'GLO1', formula: 'TPN1 - ALB1' },
          { code: 'BAG1', formula: 'ALB1 / GLO1' },
        ],
      );
      expect(out.GLO1).toBeCloseTo(3.0);
      expect(out.BAG1).toBeCloseTo(4.0 / 3.0);
    });
  });

  describe('BVLDL = TG / 5', () => {
    it('computes', () => {
      expect(calc('BVLDL', { TG: 150 })).toBeCloseTo(30);
    });
    it('returns null when TG missing', () => {
      expect(calc('BVLDL', {})).toBeNull();
    });
  });

  describe('NHDL = CHOL - BHDL', () => {
    it('computes', () => {
      expect(calc('NHDL', { CHOL: 200, BHDL: 50 })).toBeCloseTo(150);
    });
    it('returns null when missing', () => {
      expect(calc('NHDL', { CHOL: 200 })).toBeNull();
      expect(calc('NHDL', { BHDL: 50 })).toBeNull();
    });
  });

  describe('BLDL (Friedewald) = CHOL - BHDL - TG/5', () => {
    it('computes when TG <= 400', () => {
      expect(calc('BLDL', { CHOL: 200, BHDL: 50, TG: 150 })).toBeCloseTo(120);
    });
    it('still computes when TG > 400 (no longer suppressed — lab wants the number shown)', () => {
      // 200 − 50 − 401/5 = 69.8
      expect(calc('BLDL', { CHOL: 200, BHDL: 50, TG: 401 })).toBeCloseTo(69.8);
    });
    it('computes at exactly TG = 400', () => {
      expect(calc('BLDL', { CHOL: 200, BHDL: 50, TG: 400 })).toBeCloseTo(70);
    });
    it('computes on a raised lipid profile (high TG)', () => {
      // CHOL 247.9 − HDL 69.83 − TG 441.6/5 = 89.75 (the case that was blanking before)
      expect(calc('BLDL', { CHOL: 247.9, BHDL: 69.83, TG: 441.6 })).toBeCloseTo(89.75);
    });
    it('returns null when any input missing', () => {
      expect(calc('BLDL', { CHOL: 200, BHDL: 50 })).toBeNull();
      expect(calc('BLDL', { CHOL: 200, TG: 150 })).toBeNull();
      expect(calc('BLDL', { BHDL: 50, TG: 150 })).toBeNull();
    });
  });

  describe('BRAT = CHOL / BHDL', () => {
    it('computes ratio', () => {
      expect(calc('BRAT', { CHOL: 200, BHDL: 50 })).toBeCloseTo(4.0);
    });
    it('returns null on division by zero', () => {
      expect(calc('BRAT', { CHOL: 200, BHDL: 0 })).toBeNull();
    });
    it('returns null when missing', () => {
      expect(calc('BRAT', { CHOL: 200 })).toBeNull();
    });
  });

  describe('BLHR = BLDL / BHDL', () => {
    it('computes ratio', () => {
      expect(calc('BLHR', { BLDL: 120, BHDL: 60 })).toBeCloseTo(2.0);
    });
    it('returns null on division by zero', () => {
      expect(calc('BLHR', { BLDL: 120, BHDL: 0 })).toBeNull();
    });
    it('returns null when missing', () => {
      expect(calc('BLHR', { BHDL: 60 })).toBeNull();
    });
  });

  describe('EAG = 28.7 * HBA1C - 46.7', () => {
    it('computes', () => {
      expect(calc('EAG', { HBA1C: 7 })).toBeCloseTo(28.7 * 7 - 46.7);
    });
    it('returns null when HBA1C missing', () => {
      expect(calc('EAG', {})).toBeNull();
    });
  });

  describe('BUN = UREA * 0.467', () => {
    it('computes', () => {
      expect(calc('BUN', { UREA: 40 })).toBeCloseTo(40 * 0.467);
    });
    it('returns null when UREA missing', () => {
      expect(calc('BUN', {})).toBeNull();
    });
  });

  describe('INR = (PTIT / PTICT) ^ ISI', () => {
    it('applies the ISI exponent to the patient/control ratio', () => {
      // ratio 1.5, ISI 1.2 → 1.5^1.2 = 1.6198…
      expect(calc('INR', { PTIT: 18, PTICT: 12, ISI: 1.2 })).toBeCloseTo(Math.pow(1.5, 1.2), 6);
    });
    it('equals the plain ratio when ISI is 1', () => {
      expect(calc('INR', { PTIT: 18, PTICT: 12, ISI: 1 })).toBeCloseTo(1.5);
    });
    it('defaults ISI to 1 when the reagent index is not entered', () => {
      expect(calc('INR', { PTIT: 18, PTICT: 12 })).toBeCloseTo(1.5);
    });
    it('a higher ISI moves the INR further from 1 than the raw ratio', () => {
      const ratio = 18 / 12;
      const inr = calc('INR', { PTIT: 18, PTICT: 12, ISI: 1.6 }) as number;
      expect(inr).toBeGreaterThan(ratio);
    });
    it('normal PT against its control gives an INR near 1', () => {
      const inr = calc('INR', { PTIT: 13, PTICT: 13, ISI: 1.35 }) as number;
      expect(inr).toBeCloseTo(1.0);
    });
    // The standalone legacy coagulation test has no control/ISI line — its value must not move.
    it('keeps the legacy PT_PT / 12 behaviour when only PT_PT is present', () => {
      expect(calc('INR', { PT_PT: 24 })).toBeCloseTo(2.0);
    });
    it('prefers the PT/INR panel value over the legacy PT_PT when both exist', () => {
      expect(calc('INR', { PTIT: 12, PTICT: 12, PT_PT: 24 })).toBeCloseTo(1.0);
    });
    it('returns null when no prothrombin time is available', () => {
      expect(calc('INR', {})).toBeNull();
      expect(calc('INR', { PTICT: 12, ISI: 1.2 })).toBeNull();
    });
    it('returns null (never NaN/Infinity) on a zero or negative control', () => {
      for (const control of [0, -12]) {
        const v = calc('INR', { PTIT: 18, PTICT: control, ISI: 1.2 });
        expect(v).toBeNull();
        expect(Number.isNaN(v as number)).toBe(false);
      }
    });
  });

  // The PT/INR panel's Ratio and Index lines are plain stored formulas (not hardwired), so they
  // run through the generic evaluator exactly as the migration ships them.
  describe('PT/INR panel Ratio and Index formulas', () => {
    it('Ratio = PTIT / PTICT', () => {
      expect(computeCalculated('RATIO', 'PTIT / PTICT', { PTIT: 18, PTICT: 12 })).toBeCloseTo(1.5);
    });
    it('Index = PTICT / PTIT * 100 (percent)', () => {
      expect(computeCalculated('INDEX', 'PTICT / PTIT * 100', { PTIT: 15, PTICT: 12 })).toBeCloseTo(80);
    });
    it('both blank out when the control is missing', () => {
      expect(computeCalculated('RATIO', 'PTIT / PTICT', { PTIT: 18 })).toBeNull();
      expect(computeCalculated('INDEX', 'PTICT / PTIT * 100', { PTIT: 18 })).toBeNull();
    });
  });

  // Standalone bilirubin combo panels: BIL1_* prints under LFT, BIL2_* under BIOCHEMISTRY.
  describe('bilirubin combo panels', () => {
    it('BIL1_I = max(0, BIL1_T - BIL1_D)', () => {
      expect(calc('BIL1_I', { BIL1_T: 1.2, BIL1_D: 0.3 })).toBeCloseTo(0.9);
      expect(calc('BIL1_I', { BIL1_T: 0.3, BIL1_D: 1.0 })).toBe(0);
      expect(calc('BIL1_I', { BIL1_T: 1.2 })).toBeNull();
    });
    it('BIL2_I = max(0, BIL2_T - BIL2_D)', () => {
      expect(calc('BIL2_I', { BIL2_T: 2.4, BIL2_D: 0.8 })).toBeCloseTo(1.6);
      expect(calc('BIL2_I', { BIL2_T: 0.2, BIL2_D: 0.9 })).toBe(0);
      expect(calc('BIL2_I', { BIL2_D: 0.8 })).toBeNull();
    });
    it('the two combos never read each other\'s inputs', () => {
      expect(calc('BIL1_I', { BIL2_T: 1.2, BIL2_D: 0.3 })).toBeNull();
      expect(calc('BIL2_I', { BIL1_T: 1.2, BIL1_D: 0.3 })).toBeNull();
    });
  });

  describe('null-valued inputs never yield NaN', () => {
    it('treats explicit null like missing', () => {
      expect(calc('BBI', { BBT: null, BBD: null })).toBeNull();
      expect(calc('GLO', { TPN: null, ALB: 4 })).toBeNull();
      const v = calc('BAG', { ALB: null, GLO: null });
      expect(v).toBeNull();
      expect(Number.isNaN(v as number)).toBe(false);
    });
  });

  describe('GFR code returns null (computed separately)', () => {
    it('returns null', () => {
      expect(calc('GFR', { CREAT: 1.0 })).toBeNull();
    });
  });

  describe('fallback formula evaluation', () => {
    it('evaluates a simple arithmetic formula', () => {
      expect(computeCalculated('UNKNOWN', 'BBT - BBD', { BBT: 5, BBD: 2 })).toBeCloseTo(3);
    });
    it('returns null when a referenced value is missing', () => {
      expect(computeCalculated('UNKNOWN', 'BBT - BBD', { BBT: 5 })).toBeNull();
    });
    it('returns null when there is no formula', () => {
      expect(computeCalculated('UNKNOWN', '', { BBT: 5 })).toBeNull();
    });
  });
});

describe('computeGFR (CKD-EPI 2021)', () => {
  it('returns a positive rounded integer for valid male inputs', () => {
    const g = computeGFR(1.0, 40, 'MALE');
    expect(g).not.toBeNull();
    expect(g).toBeGreaterThan(0);
    expect(Number.isInteger(g as number)).toBe(true);
  });
  it('returns a positive rounded integer for valid female inputs', () => {
    const g = computeGFR(0.8, 35, 'FEMALE');
    expect(g).not.toBeNull();
    expect(g).toBeGreaterThan(0);
    expect(Number.isInteger(g as number)).toBe(true);
  });
  it('female factor yields a different (higher) value than male, same cre/age', () => {
    const male = computeGFR(0.8, 50, 'MALE') as number;
    const female = computeGFR(0.8, 50, 'FEMALE') as number;
    expect(female).not.toEqual(male);
  });
  it('returns null when creatinine <= 0', () => {
    expect(computeGFR(0, 40, 'MALE')).toBeNull();
    expect(computeGFR(-1, 40, 'MALE')).toBeNull();
  });
  it('returns null when age <= 0', () => {
    expect(computeGFR(1.0, 0, 'MALE')).toBeNull();
  });
});

describe('roundToDecimals', () => {
  it('rounds to given decimals', () => {
    expect(roundToDecimals(3.14159, 2)).toBe(3.14);
    expect(roundToDecimals(3.145, 2)).toBe(3.15);
    expect(roundToDecimals(2.5, 0)).toBe(3);
  });
  it('handles zero decimals', () => {
    expect(roundToDecimals(123.456, 0)).toBe(123);
  });
});

describe('formatResult', () => {
  it('returns empty string for null', () => {
    expect(formatResult(null, 2)).toBe('');
  });
  it('formats with fixed decimals', () => {
    expect(formatResult(3.1, 2)).toBe('3.10');
    expect(formatResult(3.14159, 2)).toBe('3.14');
    expect(formatResult(5, 0)).toBe('5');
  });
});
