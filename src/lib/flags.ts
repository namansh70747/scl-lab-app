import { TestRange, ResultType } from '@/types';

export function computeFlag(
  resultType: ResultType,
  value: string,
  ranges: TestRange[],
  patientSex: 'MALE' | 'FEMALE' | 'OTHER',
  patientAgeDays: number
): '' | 'H' | 'L' | 'A' {
  if (!value || !value.trim()) return '';

  if (resultType === 'numeric') {
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

function findRange(
  ranges: TestRange[],
  sex: 'MALE' | 'FEMALE' | 'OTHER',
  ageDays: number
): TestRange | null {
  const sexMap: Record<string, 'M' | 'F' | 'ANY'> = {
    MALE: 'M', FEMALE: 'F', OTHER: 'ANY'
  };
  const s = sexMap[sex] || 'ANY';

  // Try sex-specific first, then ANY
  const candidates = ranges.filter(r =>
    ageDays >= r.age_min_days && ageDays <= r.age_max_days
  );

  return (
    candidates.find(r => r.sex === s) ||
    candidates.find(r => r.sex === 'ANY') ||
    null
  );
}

export function patientAgeDays(age: number, ageUnit: 'YRS' | 'MTH' | 'DAYS'): number {
  switch (ageUnit) {
    case 'YRS': return Math.round(age * 365.25);
    case 'MTH': return Math.round(age * 30.44);
    case 'DAYS': return age;
  }
}
