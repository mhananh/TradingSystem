// Local-date helpers. Date keys are YYYY-MM-DD in the device's local timezone.
// Day arithmetic uses calendar components (not +24h) so DST changes cannot shift a day.

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DATE_KEY_RE.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

export function isTimeHHmm(s: unknown): s is string {
  return typeof s === 'string' && TIME_RE.test(s);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** Local midnight of a date key. */
export function parseDateKey(key: string): Date {
  const m = DATE_KEY_RE.exec(key);
  if (!m) throw new Error(`Tanggal tidak valid: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole calendar days from a to b (b - a), immune to DST. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const n = daysBetween(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

/** Local Date for a date key + HH:mm. */
export function combineDateTime(dateKey: string, time: string): Date {
  if (!isTimeHHmm(time)) throw new Error(`Jam tidak valid: ${time}`);
  const d = parseDateKey(dateKey);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Monday-based week start for a date key. */
export function weekStart(key: string): string {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(key, -dow);
}

const fmtLong = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const fmtMedium = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatLong(key: string): string {
  return fmtLong.format(parseDateKey(key));
}
export function formatShort(key: string): string {
  return fmtShort.format(parseDateKey(key));
}
export function formatMedium(key: string): string {
  return fmtMedium.format(parseDateKey(key));
}

export function formatMinutes(min: number | undefined | null): string {
  if (min == null || !Number.isFinite(min)) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} mnt`;
  return m === 0 ? `${h} j` : `${h} j ${m} mnt`;
}
