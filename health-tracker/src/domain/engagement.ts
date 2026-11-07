// Guilt-free engagement: daily focus suggestions, permanent achievements, and a consistency score.
// No streaks that "break", no failure messages — only positive, achievable next steps.
import type { DailyEntry, UserProfile } from './types';
import { addDays, daysBetween, minutesOfDay, weekStart } from '../lib/date';
import { effectiveNutrition, calculateRollingAverage } from './calc';
import { weightPoints } from './derive';

// ---------- Logging completeness (for the consistency calendar) ----------

/** 0–5: how many areas were logged that day (weight, food, sleep, symptoms/energy, activity). */
export function logScore(d: DailyEntry | undefined): number {
  if (!d) return 0;
  let s = 0;
  if (d.weightKg) s++;
  if (effectiveNutrition(d)) s++;
  if (d.sleepDurationMinutes || d.sleepQuality1to5 || d.morningRestedness) s++;
  if (d.gerdAny != null || d.gerdEpisodes.length || d.sleepinessAfterLunch1to5 || d.energy1to5) s++;
  if (d.steps != null || d.walkingMinutes || d.strengthWorkout != null) s++;
  return s;
}

export function isLogged(d: DailyEntry | undefined) {
  return logScore(d) > 0;
}

export interface CalendarCell {
  date: string;
  score: number;
  future: boolean;
}

/** Monday-aligned weeks × 7 days ending with the current week. */
export function consistencyGrid(days: DailyEntry[], today: string, weeks = 12): CalendarCell[][] {
  const by = new Map(days.map((d) => [d.date, d]));
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, w * 7 + i);
      return { date, score: logScore(by.get(date)), future: date > today };
    }),
  );
}

export function loggedDaysInLast(days: DailyEntry[], today: string, n: number) {
  const from = addDays(today, -(n - 1));
  return days.filter((d) => d.date >= from && d.date <= today && isLogged(d)).length;
}

// ---------- Fokus hari ini ----------

export type FocusKind = 'weight' | 'food' | 'protein' | 'walk' | 'strength' | 'sleep' | 'water' | 'gerd' | 'checkin';

export interface FocusItem {
  id: string;
  kind: FocusKind;
  title: string;
  detail: string;
  /** Completed automatically from logged data (in addition to the manual tick). */
  autoDone: boolean;
}

interface FocusCtx {
  today: string;
  now: Date;
  day: DailyEntry | undefined;
  days: DailyEntry[];
  profile: UserProfile;
}

/**
 * Picks up to 3 small, concrete actions for today from the user's own data.
 * Order of preference reflects the plan priorities: logging basics → protein → movement → sleep.
 */
export function buildFocus({ today, now, day, days, profile }: FocusCtx): FocusItem[] {
  const hour = now.getHours();
  const nut = effectiveNutrition(day);
  const out: FocusItem[] = [];
  const recent = days.filter((d) => d.date >= addDays(today, -6) && d.date <= today);

  if (hour < 12 || day?.weightKg)
    out.push({ id: 'weight', kind: 'weight', title: 'Timbang pagi', detail: 'Setelah ke toilet, sebelum makan — 10 detik.', autoDone: !!day?.weightKg });

  if (hour >= 13 && !nut)
    out.push({ id: 'food', kind: 'food', title: 'Catat makan siang', detail: 'Foto saja cukup — AI bantu memperkirakan.', autoDone: false });

  if (nut) {
    const remain = Math.round(profile.proteinMinG - nut.proteinG);
    out.push({
      id: 'protein',
      kind: 'protein',
      title: remain > 0 ? `Tambah ±${remain} g protein` : 'Protein hari ini tercapai',
      detail: remain > 0 ? 'Mis. 2 telur + 1 potong tempe, atau yogurt tinggi protein.' : `Sudah ≥${profile.proteinMinG} g. Bagus untuk menjaga otot.`,
      autoDone: remain <= 0,
    });
  }

  const steps = day?.steps ?? 0;
  if (hour >= 10) {
    const gap = Math.max(0, profile.stepGoal - steps);
    out.push({
      id: 'walk',
      kind: 'walk',
      title: gap > 0 ? 'Jalan 10 menit setelah makan' : 'Target langkah tercapai',
      detail: gap > 0 ? `Sisa ±${gap.toLocaleString('id-ID')} langkah menuju ${profile.stepGoal.toLocaleString('id-ID')}. Membantu kantuk setelah makan siang juga.` : 'Tetap bergerak santai bila nyaman.',
      autoDone: steps >= profile.stepGoal || (day?.walkingMinutes ?? 0) >= 10,
    });
  }

  const lastStrength = [...days].reverse().find((d) => d.strengthWorkout && d.date <= today);
  const sinceStrength = lastStrength ? daysBetween(lastStrength.date, today) : 99;
  if (sinceStrength >= 2)
    out.push({ id: 'strength', kind: 'strength', title: 'Latihan kekuatan 15 menit', detail: 'Squat, push-up, glute bridge, bird-dog. Hari ringan juga boleh.', autoDone: !!day?.strengthWorkout });

  const sleepVals = recent.filter((d) => d.sleepDurationMinutes).map((d) => d.sleepDurationMinutes!);
  const sleepAvg = sleepVals.length ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length : null;
  if (hour >= 17 && (sleepAvg == null || sleepAvg < 6.5 * 60))
    out.push({ id: 'sleep', kind: 'sleep', title: `Siap tidur pukul ${profile.bedtimeTarget ?? '22:30'}`, detail: 'Layar redup 30 menit sebelumnya. Tidur cukup membantu kantuk & rasa lapar.', autoDone: false });

  const gerdDays = recent.filter((d) => d.gerdAny || d.gerdEpisodes.length).length;
  if (gerdDays >= 2)
    out.push({ id: 'gerd', kind: 'gerd', title: 'Jeda 2–3 jam sebelum berbaring', detail: 'GERD muncul beberapa hari minggu ini. Catat jam kopi & makan untuk melihat pola.', autoDone: false });

  if ((day?.waterGlasses ?? 0) < 6 && hour >= 9)
    out.push({ id: 'water', kind: 'water', title: 'Minum air +2 gelas', detail: `Tercatat ${day?.waterGlasses ?? 0} gelas hari ini.`, autoDone: (day?.waterGlasses ?? 0) >= 8 });

  // Prefer not-yet-done items, keep max 3, but keep completed ones visible for a sense of progress.
  const pending = out.filter((f) => !f.autoDone);
  const done = out.filter((f) => f.autoDone);
  return [...done.slice(0, 1), ...pending].slice(0, 3);
}

export function focusDone(item: FocusItem, day: DailyEntry | undefined) {
  return item.autoDone || (day?.focusDone ?? []).includes(item.id);
}

// ---------- Pencapaian permanen ----------

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  icon: 'spark' | 'calendar' | 'scale' | 'moon' | 'dumbbell' | 'egg' | 'walk' | 'camera' | 'leaf' | 'flag' | 'trophy';
  /** Returns progress 0–1 from history (1 = earned). */
  progress: (ctx: { days: DailyEntry[]; profile: UserProfile; today: string }) => number;
}

const countWhere = (days: DailyEntry[], f: (d: DailyEntry) => boolean) => days.filter(f).length;

function trendLoss(days: DailyEntry[], profile: UserProfile): number {
  const r = calculateRollingAverage(weightPoints(days));
  const last = [...r].reverse().find((x) => x.average != null);
  return last?.average != null ? profile.startingWeightKg - last.average : 0;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', title: 'Langkah pertama', detail: 'Mencatat hari pertama.', icon: 'spark', progress: ({ days }) => Math.min(1, countWhere(days, isLogged)) },
  { id: 'log7', title: '7 hari tercatat', detail: 'Total 7 hari dengan catatan (tidak harus berturut-turut).', icon: 'calendar', progress: ({ days }) => Math.min(1, countWhere(days, isLogged) / 7) },
  { id: 'log30', title: '30 hari tercatat', detail: 'Total 30 hari dengan catatan.', icon: 'calendar', progress: ({ days }) => Math.min(1, countWhere(days, isLogged) / 30) },
  { id: 'log100', title: '100 hari tercatat', detail: 'Kebiasaan yang benar-benar terbentuk.', icon: 'trophy', progress: ({ days }) => Math.min(1, countWhere(days, isLogged) / 100) },
  { id: 'weigh10', title: '10 timbangan', detail: 'Cukup data untuk melihat tren, bukan angka harian.', icon: 'scale', progress: ({ days }) => Math.min(1, countWhere(days, (d) => !!d.weightKg) / 10) },
  { id: 'sleep7', title: '7 malam ≥ 6,5 jam', detail: 'Total 7 malam tidur minimal 6,5 jam.', icon: 'moon', progress: ({ days }) => Math.min(1, countWhere(days, (d) => (d.sleepDurationMinutes ?? 0) >= 390) / 7) },
  { id: 'sleep7h', title: '7 malam ≥ 7 jam', detail: 'Total 7 malam tidur minimal 7 jam.', icon: 'moon', progress: ({ days }) => Math.min(1, countWhere(days, (d) => (d.sleepDurationMinutes ?? 0) >= 420) / 7) },
  { id: 'strength10', title: '10 sesi kekuatan', detail: 'Otot terjaga saat berat turun.', icon: 'dumbbell', progress: ({ days }) => Math.min(1, countWhere(days, (d) => !!d.strengthWorkout) / 10) },
  { id: 'strength25', title: '25 sesi kekuatan', detail: 'Konsistensi latihan yang solid.', icon: 'dumbbell', progress: ({ days }) => Math.min(1, countWhere(days, (d) => !!d.strengthWorkout) / 25) },
  {
    id: 'protein14',
    title: '14 hari protein cukup',
    detail: 'Total 14 hari mencapai protein minimal.',
    icon: 'egg',
    progress: ({ days, profile }) => Math.min(1, countWhere(days, (d) => (effectiveNutrition(d)?.proteinG ?? 0) >= profile.proteinMinG) / 14),
  },
  {
    id: 'walk150',
    title: 'Minggu 150 menit',
    detail: '150 menit jalan dalam satu minggu (Senin–Minggu).',
    icon: 'walk',
    progress: ({ days }) => {
      const byWeek = new Map<string, number>();
      days.forEach((d) => byWeek.set(weekStart(d.date), (byWeek.get(weekStart(d.date)) ?? 0) + (d.walkingMinutes ?? 0)));
      return Math.min(1, Math.max(0, ...byWeek.values()) / 150);
    },
  },
  { id: 'photo1', title: 'Foto makanan pertama', detail: 'Mencoba perkiraan kalori dari foto.', icon: 'camera', progress: ({ days }) => (days.some((d) => d.meals.some((m) => m.source === 'ai-photo' || m.source === 'ai-label')) ? 1 : 0) },
  {
    id: 'calmweek',
    title: 'Minggu tenang',
    detail: '7 hari berturut tanpa GERD tercatat (sekali tercapai, tetap milikmu).',
    icon: 'leaf',
    progress: ({ days }) => {
      let best = 0;
      let run = 0;
      let prev: string | null = null;
      for (const d of days) {
        const logged = d.gerdAny != null || d.gerdEpisodes.length > 0;
        const calm = logged && !d.gerdAny && d.gerdEpisodes.length === 0;
        run = calm && prev && daysBetween(prev, d.date) === 1 ? run + 1 : calm ? 1 : 0;
        prev = d.date;
        best = Math.max(best, run);
      }
      return Math.min(1, best / 7);
    },
  },
  { id: 'loss2', title: '−2 kg (tren)', detail: 'Rata-rata 7 hari turun 2 kg dari awal.', icon: 'flag', progress: ({ days, profile }) => Math.max(0, Math.min(1, trendLoss(days, profile) / 2)) },
  { id: 'loss5', title: '−5 kg (tren)', detail: 'Rata-rata 7 hari turun 5 kg dari awal.', icon: 'flag', progress: ({ days, profile }) => Math.max(0, Math.min(1, trendLoss(days, profile) / 5)) },
  { id: 'loss10', title: '−10 kg (tren)', detail: 'Rata-rata 7 hari turun 10 kg dari awal.', icon: 'trophy', progress: ({ days, profile }) => Math.max(0, Math.min(1, trendLoss(days, profile) / 10)) },
];

export interface AchievementState {
  a: Achievement;
  progress: number;
  earnedAt?: string;
}

/**
 * Combine stored earned dates with current progress. Once earned, an achievement stays earned
 * even if later data would no longer qualify. Returns newly earned ids to persist/celebrate.
 */
export function evaluateAchievements(days: DailyEntry[], profile: UserProfile, today: string, earned: Record<string, string>) {
  const sorted = [...days].sort((x, y) => x.date.localeCompare(y.date));
  const newly: string[] = [];
  const list: AchievementState[] = ACHIEVEMENTS.map((a) => {
    const p = a.progress({ days: sorted, profile, today });
    let at = earned[a.id];
    if (!at && p >= 1) {
      at = today;
      newly.push(a.id);
    }
    return { a, progress: at ? 1 : p, earnedAt: at };
  });
  return { list, newly };
}

/** Is it after first meal time? Utility for copy tweaks. */
export function afterTime(now: Date, hhmm: string) {
  return now.getHours() * 60 + now.getMinutes() >= minutesOfDay(hhmm);
}
