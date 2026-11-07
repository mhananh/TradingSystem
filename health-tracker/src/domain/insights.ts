// Weekly summaries and cautious, threshold-gated insights. Never causal claims.
import type { DailyEntry, UserProfile } from './types';
import { addDays, daysBetween, minutesOfDay, timeOf } from '../lib/date';
import { calculateFastingDuration, effectiveNutrition, linearSlopePerDay, classifyPace, type PaceLabel } from './calc';

export const MIN_GROUP = 5;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
/** Indonesian decimal comma. */
const dec = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

export function daysInRange(days: DailyEntry[], start: string, end: string) {
  return days.filter((d) => d.date >= start && d.date <= end);
}

export interface WeekSummary {
  start: string;
  end: string;
  loggedDays: number;
  avgWeight: number | null;
  weighIns: number;
  avgKcal: number | null; // over days with complete nutrition
  avgProtein: number | null;
  completeNutritionDays: number;
  proteinMetDays: number;
  avgSleepMin: number | null;
  sleepNights: number;
  avgSleepinessAfterLunch: number | null;
  avgSleepinessMorning: number | null;
  gerdDays: number;
  gerdLoggedDays: number;
  walkingMin: number;
  strengthSessions: number;
  avgSteps: number | null;
  avgRestingHr: number | null;
}

export function summarizeWeek(days: DailyEntry[], start: string, proteinMinG: number): WeekSummary {
  const end = addDays(start, 6);
  const w = daysInRange(days, start, end);
  const weights = w.filter((d) => d.weightKg).map((d) => d.weightKg!);
  const complete = w.filter((d) => d.nutritionComplete && effectiveNutrition(d));
  const nut = complete.map((d) => effectiveNutrition(d)!);
  const sleep = w.filter((d) => d.sleepDurationMinutes).map((d) => d.sleepDurationMinutes!);
  const gerdLogged = w.filter((d) => d.gerdAny != null || d.gerdEpisodes.length > 0);
  return {
    start,
    end,
    loggedDays: w.length,
    avgWeight: r1(avg(weights)),
    weighIns: weights.length,
    avgKcal: nut.length ? Math.round(avg(nut.map((n) => n.caloriesKcal))!) : null,
    avgProtein: nut.length ? Math.round(avg(nut.map((n) => n.proteinG))!) : null,
    completeNutritionDays: nut.length,
    proteinMetDays: nut.filter((n) => n.proteinG >= proteinMinG).length,
    avgSleepMin: sleep.length ? Math.round(avg(sleep)!) : null,
    sleepNights: sleep.length,
    avgSleepinessAfterLunch: r1(avg(w.filter((d) => d.sleepinessAfterLunch1to5).map((d) => d.sleepinessAfterLunch1to5!))),
    avgSleepinessMorning: r1(avg(w.filter((d) => d.sleepinessMorning1to5).map((d) => d.sleepinessMorning1to5!))),
    gerdDays: gerdLogged.filter((d) => d.gerdAny || d.gerdEpisodes.length > 0).length,
    gerdLoggedDays: gerdLogged.length,
    walkingMin: w.reduce((s, d) => s + (d.walkingMinutes ?? 0), 0),
    strengthSessions: w.filter((d) => d.strengthWorkout).length,
    avgSteps: (() => {
      const s = w.filter((d) => d.steps != null).map((d) => d.steps!);
      return s.length ? Math.round(avg(s)!) : null;
    })(),
    avgRestingHr: r1(avg(w.filter((d) => d.restingHr).map((d) => d.restingHr!))),
  };
}

export type InsightTone = 'neutral' | 'positive' | 'caution';

export interface Insight {
  id: string;
  question: string;
  status: 'ready' | 'insufficient';
  tone: InsightTone;
  text: string;
  detail?: string;
  needed?: string;
}

function insufficient(id: string, question: string, needed: string): Insight {
  return { id, question, status: 'insufficient', tone: 'neutral', text: 'Belum cukup data untuk menyimpulkan.', needed };
}

export function trendInsight(days: DailyEntry[], today: string, currentWeight: number | null): Insight & { pace?: PaceLabel; kgPerWeek?: number } {
  const q = 'Apakah laju turun beratku berkelanjutan?';
  const start = addDays(today, -27);
  const pts = daysInRange(days, start, today)
    .filter((d) => d.weightKg)
    .map((d) => ({ date: d.date, value: d.weightKg! }));
  const span = pts.length ? daysBetween(pts[0].date, pts[pts.length - 1].date) : 0;
  if (pts.length < 10 || span < 14) return insufficient('trend', q, `butuh ≥10 penimbangan dalam ≥14 hari (sekarang ${pts.length})`);
  const slope = linearSlopePerDay(pts)!;
  const kgPerWeek = Math.round(-slope * 7 * 100) / 100;
  const pace = classifyPace(kgPerWeek, currentWeight ?? pts[pts.length - 1].value);
  let text: string;
  let tone: InsightTone = 'neutral';
  if (kgPerWeek <= 0.05) {
    text = `Tren 4 minggu terakhir relatif datar (${dec(kgPerWeek, 2)} kg/minggu). Cek dulu kelengkapan catatan (minyak, minuman, camilan), tidur, dan langkah sebelum mengubah apa pun.`;
  } else if (pace === 'too_fast') {
    text = `Tren turun ±${dec(kgPerWeek, 2)} kg/minggu — lebih cepat dari 1,5% berat badan per minggu. Pertimbangkan menambah makan/protein agar otot terjaga, dan bicarakan dengan tenaga kesehatan bila disengaja.`;
    tone = 'caution';
  } else if (pace === 'ambitious') {
    text = `Tren turun ±${dec(kgPerWeek, 2)} kg/minggu — termasuk cepat. Pastikan protein, tidur, dan energi tetap baik.`;
    tone = 'caution';
  } else {
    text = `Tren turun ±${dec(kgPerWeek, 2)} kg/minggu — dalam rentang yang umumnya dianggap berkelanjutan.`;
    tone = 'positive';
  }
  return { id: 'trend', question: q, status: 'ready', tone, text, pace, kgPerWeek, detail: 'Dihitung dari garis tren penimbangan 28 hari terakhir, bukan dari satu angka harian.' };
}

export function proteinInsight(days: DailyEntry[], today: string, proteinMinG: number): Insight {
  const q = 'Apakah proteinku cukup?';
  const w = daysInRange(days, addDays(today, -13), today).filter((d) => d.nutritionComplete && effectiveNutrition(d));
  if (w.length < 7) return insufficient('protein', q, `butuh ≥7 hari catatan makan lengkap (sekarang ${w.length})`);
  const met = w.filter((d) => effectiveNutrition(d)!.proteinG >= proteinMinG).length;
  const pct = Math.round((met / w.length) * 100);
  return {
    id: 'protein',
    question: q,
    status: 'ready',
    tone: pct >= 70 ? 'positive' : 'neutral',
    text: `Protein ≥${proteinMinG} g tercapai di ${met} dari ${w.length} hari lengkap (${pct}%).`,
    detail: pct < 70 ? 'Tips: tambah satu sumber protein di tiap makan (telur, tempe/tahu, ayam, ikan, yogurt).' : undefined,
  };
}

export function sleepInsight(days: DailyEntry[], today: string): Insight {
  const q = 'Apakah tidurku membaik?';
  const cur = daysInRange(days, addDays(today, -6), today).filter((d) => d.sleepDurationMinutes);
  const prev = daysInRange(days, addDays(today, -13), addDays(today, -7)).filter((d) => d.sleepDurationMinutes);
  if (cur.length < 4 || prev.length < 4) return insufficient('sleep', q, `butuh ≥4 malam di minggu ini dan minggu lalu (sekarang ${cur.length} & ${prev.length})`);
  const a = avg(cur.map((d) => d.sleepDurationMinutes!))!;
  const b = avg(prev.map((d) => d.sleepDurationMinutes!))!;
  const diff = Math.round(a - b);
  return {
    id: 'sleep',
    question: q,
    status: 'ready',
    tone: diff > 10 ? 'positive' : 'neutral',
    text: `Rata-rata tidur 7 hari terakhir ${Math.floor(a / 60)} j ${Math.round(a % 60)} mnt (${diff >= 0 ? '+' : ''}${diff} mnt dibanding minggu sebelumnya).`,
  };
}

export function sleepinessInsight(days: DailyEntry[], today: string): Insight {
  const q = 'Apakah kantuk siang membaik?';
  const pick = (d: DailyEntry) => d.sleepinessAfterLunch1to5;
  const cur = daysInRange(days, addDays(today, -6), today).filter((d) => pick(d));
  const prev = daysInRange(days, addDays(today, -13), addDays(today, -7)).filter((d) => pick(d));
  if (cur.length < 4 || prev.length < 4) return insufficient('sleepiness', q, `butuh ≥4 hari skor kantuk setelah makan siang di minggu ini dan minggu lalu`);
  const a = avg(cur.map((d) => pick(d)!))!;
  const b = avg(prev.map((d) => pick(d)!))!;
  return {
    id: 'sleepiness',
    question: q,
    status: 'ready',
    tone: a < b - 0.3 ? 'positive' : 'neutral',
    text: `Kantuk setelah makan siang rata-rata ${dec(a, 1)}/5 (minggu lalu ${dec(b, 1)}/5).`,
  };
}

function fastMinutes(d: DailyEntry) {
  return calculateFastingDuration(d.fastingStartAt, d.fastingEndAt);
}

function hadGerd(d: DailyEntry) {
  return !!d.gerdAny || d.gerdEpisodes.length > 0;
}

function gerdLogged(d: DailyEntry) {
  return d.gerdAny != null || d.gerdEpisodes.length > 0;
}

/** Was the first coffee before the first meal / end of fast? */
export function coffeeBeforeFirstMeal(d: DailyEntry): boolean | null {
  if (!d.coffeeTime || !(d.coffeeCups && d.coffeeCups > 0)) return null;
  const firstMeal = d.fastingEndAt ? timeOf(d.fastingEndAt) : d.meals.map((m) => m.time).filter(Boolean).sort()[0];
  if (!firstMeal) return null;
  return minutesOfDay(d.coffeeTime) < minutesOfDay(firstMeal);
}

function compareGroups(id: string, question: string, days: DailyEntry[], inA: (d: DailyEntry) => boolean | null, labelA: string, labelB: string, confounders: string): Insight {
  const logged = days.filter(gerdLogged);
  const a = logged.filter((d) => inA(d) === true);
  const b = logged.filter((d) => inA(d) === false);
  if (a.length < MIN_GROUP || b.length < MIN_GROUP)
    return insufficient(id, question, `butuh ≥${MIN_GROUP} hari di tiap kelompok dengan status GERD tercatat (sekarang ${a.length} & ${b.length})`);
  const pa = Math.round((a.filter(hadGerd).length / a.length) * 100);
  const pb = Math.round((b.filter(hadGerd).length / b.length) * 100);
  const diff = pa - pb;
  const text =
    Math.abs(diff) < 15
      ? `Belum terlihat perbedaan yang jelas: GERD muncul di ${pa}% hari ${labelA} vs ${pb}% hari ${labelB}.`
      : `GERD muncul di ${pa}% hari ${labelA} vs ${pb}% hari ${labelB}. Ini mungkin berkaitan, tapi belum tentu penyebabnya.`;
  return { id, question, status: 'ready', tone: diff >= 15 ? 'caution' : 'neutral', text, detail: confounders };
}

export function fastingGerdInsight(days: DailyEntry[], today: string): Insight {
  const w = daysInRange(days, addDays(today, -59), today);
  return compareGroups(
    'fasting-gerd',
    'Apakah puasa panjang berkaitan dengan GERD?',
    w,
    (d) => {
      const m = fastMinutes(d);
      if (m == null) return d.fastingStartAt || d.fastingEndAt ? null : false;
      return m >= 14 * 60;
    },
    'puasa ≥14 jam',
    'lainnya',
    'Faktor lain bisa ikut berperan, mis. kopi sebelum makan, makan malam larut, porsi besar, atau stres.',
  );
}

export function coffeeGerdInsight(days: DailyEntry[], today: string): Insight {
  const w = daysInRange(days, addDays(today, -59), today);
  return compareGroups(
    'coffee-gerd',
    'Apakah kopi sebelum makan berkaitan dengan GERD?',
    w,
    (d) => {
      if (!d.coffeeCups) return d.coffeeCups === 0 ? false : null;
      return coffeeBeforeFirstMeal(d);
    },
    'kopi sebelum makan pertama',
    'tanpa kopi/kopi setelah makan',
    'Pemicu GERD sangat individual. Hindari hanya yang berulang kali memicu gejala.',
  );
}

export function sleepVsSleepinessInsight(days: DailyEntry[], today: string): Insight {
  const q = 'Apakah tidur pendek berkaitan dengan kantuk siang?';
  const w = daysInRange(days, addDays(today, -59), today).filter((d) => d.sleepDurationMinutes && d.sleepinessAfterLunch1to5);
  const short = w.filter((d) => d.sleepDurationMinutes! < 360);
  const long = w.filter((d) => d.sleepDurationMinutes! >= 420);
  if (short.length < MIN_GROUP || long.length < MIN_GROUP)
    return insufficient('sleep-sleepiness', q, `butuh ≥${MIN_GROUP} hari tidur <6 jam dan ≥${MIN_GROUP} hari tidur ≥7 jam (sekarang ${short.length} & ${long.length})`);
  const a = avg(short.map((d) => d.sleepinessAfterLunch1to5!))!;
  const b = avg(long.map((d) => d.sleepinessAfterLunch1to5!))!;
  return {
    id: 'sleep-sleepiness',
    question: q,
    status: 'ready',
    tone: 'neutral',
    text: `Kantuk siang rata-rata ${dec(a, 1)}/5 setelah tidur <6 jam vs ${dec(b, 1)}/5 setelah tidur ≥7 jam.`,
    detail:
      a - b < 0.5
        ? 'Bila kantuk tetap berat meski tidur cukup, itu alasan baik untuk membahas kualitas tidur dengan tenaga kesehatan.'
        : 'Pola ini mungkin berkaitan; jumlah tidur tampaknya penting untukmu.',
  };
}

export function exerciseInsight(days: DailyEntry[], today: string): Insight {
  const q = 'Apakah latihanku makin konsisten?';
  const w = daysInRange(days, addDays(today, -27), today);
  if (w.length < 14) return insufficient('exercise', q, `butuh ≥14 hari tercatat (sekarang ${w.length})`);
  const weeks = [0, 1, 2, 3].map((i) => {
    const s = addDays(today, -27 + i * 7);
    const wk = daysInRange(days, s, addDays(s, 6));
    return { strength: wk.filter((d) => d.strengthWorkout).length, walk: wk.reduce((t, d) => t + (d.walkingMinutes ?? 0), 0) };
  });
  return {
    id: 'exercise',
    question: q,
    status: 'ready',
    tone: weeks[3].strength >= 2 ? 'positive' : 'neutral',
    text: `Sesi kekuatan per minggu: ${weeks.map((x) => x.strength).join(' → ')}. Menit jalan: ${weeks.map((x) => x.walk).join(' → ')}.`,
  };
}

export function buildInsights(days: DailyEntry[], profile: UserProfile, today: string, currentWeight: number | null): Insight[] {
  return [
    trendInsight(days, today, currentWeight),
    proteinInsight(days, today, profile.proteinMinG),
    sleepInsight(days, today),
    sleepinessInsight(days, today),
    sleepVsSleepinessInsight(days, today),
    fastingGerdInsight(days, today),
    coffeeGerdInsight(days, today),
    exerciseInsight(days, today),
  ];
}

export interface CheckpointAdvice {
  due: boolean;
  steps: string[];
  kind: 'slow' | 'fast' | 'ok' | 'insufficient';
}

/** Week-4+ checkpoint: when progress is slow, check behaviours BEFORE suggesting any intake change. */
export function checkpointAdvice(days: DailyEntry[], profile: UserProfile, today: string, kgPerWeek: number | null): CheckpointAdvice {
  const since = daysBetween(profile.startingWeightDate, today);
  if (since < 28) return { due: false, steps: [], kind: 'insufficient' };
  if (kgPerWeek == null) return { due: true, steps: ['Timbang lebih rutin (mis. 3–7× seminggu di pagi hari) agar tren bisa dihitung.'], kind: 'insufficient' };
  if (kgPerWeek > 1 && since > 14)
    return {
      due: true,
      kind: 'fast',
      steps: ['Laju di atas 1 kg/minggu. Pertimbangkan menambah porsi, terutama protein, agar massa otot dan energi terjaga.'],
    };
  if (kgPerWeek >= 0.4) return { due: true, kind: 'ok', steps: ['Laju dalam rentang wajar. Lanjutkan kebiasaan yang sudah berjalan.'] };
  const recent = daysInRange(days, addDays(today, -13), today);
  const completeRatio = recent.filter((d) => d.nutritionComplete).length / 14;
  const sleepAvg = avg(recent.filter((d) => d.sleepDurationMinutes).map((d) => d.sleepDurationMinutes!));
  const stepsAvg = avg(recent.filter((d) => d.steps != null).map((d) => d.steps!));
  const steps: string[] = [];
  steps.push(
    completeRatio < 0.8
      ? `1. Kelengkapan catatan: hanya ${Math.round(completeRatio * 100)}% hari tercatat lengkap. Minyak goreng, santan, minuman manis, dan camilan sering terlewat.`
      : '1. Kelengkapan catatan sudah baik. Cek ulang minyak, saus, dan minuman yang mungkin terlewat.',
  );
  steps.push(sleepAvg != null && sleepAvg < 390 ? `2. Tidur rata-rata ${Math.round(sleepAvg / 60 * 10) / 10} jam — tidur pendek berkaitan dengan lapar & pilihan makan.` : '2. Tidur: pertahankan kesempatan tidur 7–9 jam.');
  steps.push(stepsAvg != null ? `3. Langkah rata-rata ${Math.round(stepsAvg)}/hari — menambah 1.000–2.000 langkah sering lebih mudah daripada mengurangi makan.` : '3. Catat langkah harian agar aktivitas bisa dinilai.');
  steps.push(
    `4. Baru setelah itu, bila semua sudah baik, kamu bisa mempertimbangkan pengurangan kecil (mis. 100–150 kkal) — tidak di bawah ${profile.calorieFloorKcal} kkal. Keputusan ada di tanganmu.`,
  );
  return { due: true, kind: 'slow', steps };
}
