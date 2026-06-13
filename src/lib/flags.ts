import { TestRange, ResultType } from '@/types';

export function computeFlag(
  resultType: ResultType,
  value: string,
  ranges: TestRange[],
  patientSex: 'MALE' | 'FEMALE' | 'OTHER',
  patientAgeDays: number
): '' | 'H' | 'L' | 'A' {
  if (!value || !value.trim()) return '';

  if (resultType === 'numeric' || resultType === 'calculated') {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return '';

    const range = findRange(ranges, patientSex, patientAgeDays);
    if (!range) return '';

    if (range.high != null && num > range.high) return 'H';
    if (range.low != null && num < range.low) return 'L';
    return '';
  }

  if (resultType === 'choice' || resultType === 'text') {
    // Abnormal qualitative: flag if not the normal value
    const normalValues = ['NEGATIVE', 'NIL', 'NOT SEEN', 'ABSENT', 'NORMAL', 'CLEAR', 'PALE YELLOW'];
    const upper = value.toUpperCase().trim();
    if (normalValues.includes(upper)) return '';
    // Check if range_text says Negative/Nil/etc.
    const range = findRange(ranges, patientSex, patientAgeDays);
    if (range?.range_text) {
      const rt = range.range_text.toUpperCase();
      if (['NEGATIVE', 'NIL', 'NOT SEEN', 'ABSENT', 'NORMAL'].includes(rt) && upper !== rt) {
        return 'A';
      }
    }
    return '';
  }

  return '';
}

export function findRange(
  ranges: TestRange[],
  sex: 'MALE' | 'FEMALE' | 'OTHER',
  ageDays: number
): TestRange | null {
  const sexMap: Record<string, 'M' | 'F' | 'ANY'> = {
    MALE: 'M', FEMALE: 'F', OTHER: 'ANY'
  };
  const s = sexMap[sex] || 'ANY';

  // Sex-specific first, then ANY. Never fall back to the OTHER sex's range — applying the
  // wrong sex's limits would produce a clinically wrong H/L flag.
  const candidates = ranges.filter(r =>
    ageDays >= r.age_min_days && ageDays <= r.age_max_days
  );

  return (
    candidates.find(r => r.sex === s) ||
    candidates.find(r => r.sex === 'ANY') ||
    (s === 'ANY' ? candidates[0] : null) ||
    null
  );
}

/** The printed "Normal Ranges" string for a patient. Prefers the exact stored
 *  range_text; otherwise synthesises from low/high so the report is never blank. */
export function displayRange(r: TestRange | null): string {
  if (!r) return '';
  if (r.range_text && r.range_text.trim()) return r.range_text.trim();
  const sexTag = r.sex === 'M' ? ' (M)' : r.sex === 'F' ? ' (F)' : '';
  if (r.low != null && r.high != null) return `${r.low} - ${r.high}${sexTag}`;
  if (r.high != null) return `< ${r.high}${sexTag}`;
  if (r.low != null) return `> ${r.low}${sexTag}`;
  return '';
}

export function patientAgeDays(age: number, ageUnit: 'YRS' | 'MTH' | 'DAYS'): number {
  switch (ageUnit) {
    case 'YRS': return Math.round(age * 365.25);
    case 'MTH': return Math.round(age * 30.44);
    case 'DAYS': return age;
    default: return Math.round(age * 365.25);   // unexpected unit → treat as years
  }
}
