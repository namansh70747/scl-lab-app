/**
 * SQLite's CURRENT_TIMESTAMP returns UTC as "YYYY-MM-DD HH:MM:SS" with NO timezone
 * marker. `new Date()` parses that space-separated form as *local* time, which shifts
 * the displayed day (the off-by-one "Report DATE" bug). Normalise such values to
 * explicit UTC so every timestamp converts to local time correctly and consistently.
 */
export function parseDbDate(dt: string): Date {
  if (dt.includes('T')) return new Date(dt); // already ISO (e.g. nowISO())
  const m = /^(\d{4}-\d{2}-\d{2})[ ](\d{2}:\d{2}:\d{2})/.exec(dt);
  if (m) return new Date(`${m[1]}T${m[2]}Z`); // SQLite UTC → explicit UTC
  return new Date(dt);
}

export function formatDate(dt: string | null): string {
  if (!dt) return '—';
  const d = parseDbDate(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dt: string | null): string {
  if (!dt) return '—';
  const d = parseDbDate(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayDateISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function ageDisplay(age: number, unit: string): string {
  return `${age} ${unit}`;
}
