// Le date sono stringhe YYYY-MM-DD in ora locale; l'aritmetica passa da UTC per evitare problemi con l'ora legale.

export function todayISO(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const fmtLong = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

function asLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Mercoledì 30 settembre" */
export function formatLong(date: string): string {
  const s = fmtLong.format(asLocalDate(date));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShort(date: string): string {
  return fmtShort.format(asLocalDate(date));
}
