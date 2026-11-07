const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const fmt0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : nf0.format(n));
export const fmt1 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : nf1.format(n));
export const fmt2 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : nf2.format(n));

export function signed1(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf1.format(Math.abs(n))}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 4) return 'Selamat malam';
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}
