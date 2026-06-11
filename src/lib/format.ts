export function formatDate(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
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
