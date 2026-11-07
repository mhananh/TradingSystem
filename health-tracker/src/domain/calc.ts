// Pure calculation functions. All results are ESTIMATES unless stated otherwise.
import type { ActivityLevel, DailyEntry, MealEntry, SexForBmr } from './types';
import { addDays, combineDateTime, daysBetween, isTimeHHmm } from '../lib/date';

export const KCAL_PER_KG = 7700; // common approximation for body-fat energy; an estimate, not exact.

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

export interface BmrInput {
  sexForBmr: SexForBmr;
  ageYears: number;
  heightCm: number;
  weightKg: number;
}

const finitePos = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Mifflin–St Jeor. Returns null for missing/implausible input instead of throwing. */
export function calculateBmrMifflin(p: BmrInput): number | null {
  if (!finitePos(p.weightKg) || !finitePos(p.heightCm) || !finitePos(p.ageYears)) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears;
  return Math.round(base + (p.sexForBmr === 'male' ? 5 : -161));
}

export function calculateTdee(bmr: number | null, activityMultiplier: number): number | null {
  if (bmr == null || !finitePos(activityMultiplier)) return null;
  return Math.round(bmr * activityMultiplier);
}

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!finitePos(weightKg) || !finitePos(heightCm)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const nn = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

export function calculateMacroCalories(m: Partial<Macros>) {
  const protein = nn(m.proteinG) * 4;
  const carbs = nn(m.carbsG) * 4;
  const fat = nn(m.fatG) * 9;
  return { protein, carbs, fat, total: protein + carbs + fat };
}

export interface NutritionTotals {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function calculateDailyNutritionTotals(meals: Pick<MealEntry, 'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG'>[]): NutritionTotals {
  const t = meals.reduce(
    (acc, m) => ({
      caloriesKcal: acc.caloriesKcal + nn(m.caloriesKcal),
      proteinG: acc.proteinG + nn(m.proteinG),
      carbsG: acc.carbsG + nn(m.carbsG),
      fatG: acc.fatG + nn(m.fatG),
    }),
    { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    caloriesKcal: Math.round(t.caloriesKcal),
    proteinG: Math.round(t.proteinG * 10) / 10,
    carbsG: Math.round(t.carbsG * 10) / 10,
    fatG: Math.round(t.fatG * 10) / 10,
  };
}

/**
 * Nutrition for a day: itemised meals win; otherwise quick totals; otherwise null (= not logged).
 * Missing data is never treated as zero intake.
 */
export function effectiveNutrition(day: Pick<DailyEntry, 'meals' | 'totalCaloriesKcal' | 'totalProteinG' | 'totalCarbsG' | 'totalFatG'> | undefined): NutritionTotals | null {
  if (!day) return null;
  if (day.meals && day.meals.length > 0) return calculateDailyNutritionTotals(day.meals);
  if (day.totalCaloriesKcal == null && day.totalProteinG == null) return null;
  return {
    caloriesKcal: nn(day.totalCaloriesKcal),
    proteinG: nn(day.totalProteinG),
    carbsG: nn(day.totalCarbsG),
    fatG: nn(day.totalFatG),
  };
}

function toDate(v: Date | string | undefined | null): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Minutes between two timestamps. Handles midnight/date boundaries; rejects negative or > 72 h. */
export function calculateFastingDuration(start: Date | string | undefined | null, end: Date | string | undefined | null): number | null {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return null;
  const min = Math.round((e.getTime() - s.getTime()) / 60000);
  if (min <= 0 || min > 72 * 60) return null;
  return min;
}

/** Minutes asleep between bedtime and wake time. Rejects negative or > 24 h. */
export function calculateSleepDuration(start: Date | string | undefined | null, end: Date | string | undefined | null): number | null {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return null;
  const min = Math.round((e.getTime() - s.getTime()) / 60000);
  if (min <= 0 || min > 24 * 60) return null;
  return min;
}

/**
 * Build sleep timestamps from clock times, attributed to the wake date.
 * If bedtime is later in the day than wake time (e.g. 23:30 → 05:30) bedtime is on the previous day.
 */
export function sleepFromClockTimes(wakeDateKey: string, bedTime: string, wakeTime: string) {
  if (!isTimeHHmm(bedTime) || !isTimeHHmm(wakeTime)) return null;
  const wake = combineDateTime(wakeDateKey, wakeTime);
  let bed = combineDateTime(wakeDateKey, bedTime);
  if (bed.getTime() >= wake.getTime()) bed = combineDateTime(addDays(wakeDateKey, -1), bedTime);
  const minutes = calculateSleepDuration(bed, wake);
  if (minutes == null) return null;
  return { sleepStartAt: bed.toISOString(), wakeAt: wake.toISOString(), minutes };
}

/** Fasting window from clock times, attributed to the date the fast ends. */
export function fastFromClockTimes(endDateKey: string, startTime: string, endTime: string) {
  if (!isTimeHHmm(startTime) || !isTimeHHmm(endTime)) return null;
  const end = combineDateTime(endDateKey, endTime);
  let start = combineDateTime(endDateKey, startTime);
  if (start.getTime() >= end.getTime()) start = combineDateTime(addDays(endDateKey, -1), startTime);
  const minutes = calculateFastingDuration(start, end);
  if (minutes == null) return null;
  return { fastingStartAt: start.toISOString(), fastingEndAt: end.toISOString(), minutes };
}

export interface DatedValue {
  date: string;
  value: number;
}

/**
 * Trailing rolling average over calendar days. Missing dates are ignored (never zero).
 * Returns null for a point when fewer than `minPoints` values exist in its window.
 */
export function calculateRollingAverage(points: DatedValue[], windowDays = 7, minPoints = 3): { date: string; value: number; average: number | null }[] {
  const sorted = points.filter((p) => Number.isFinite(p.value) && p.value > 0).sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const inWindow = sorted.filter((q) => {
      const d = daysBetween(q.date, p.date);
      return d >= 0 && d < windowDays;
    });
    const average = inWindow.length >= minPoints ? Math.round((inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length) * 100) / 100 : null;
    return { date: p.date, value: p.value, average };
  });
}

/** Negative = loss. */
export function calculateWeightChange(start: number, current: number): number | null {
  if (!finitePos(start) || !finitePos(current)) return null;
  return Math.round((current - start) * 10) / 10;
}

/** Average kg/week that must be lost to reach goal by targetDate. Positive = loss needed. */
export function calculateRequiredWeeklyRate(current: number, goal: number, targetDate: string | undefined, today: string): number | null {
  if (!finitePos(current) || !finitePos(goal) || !targetDate) return null;
  const days = daysBetween(today, targetDate);
  if (days <= 0) return null;
  return Math.round(((current - goal) / (days / 7)) * 100) / 100;
}

export interface GoalProgress {
  percent: number; // 0–100
  movedAway: boolean;
  reached: boolean;
}

export function calculateGoalProgressPercent(start: number, current: number, goal: number): GoalProgress | null {
  if (!finitePos(start) || !finitePos(current) || !finitePos(goal) || start === goal) return null;
  const losing = goal < start;
  const done = losing ? start - current : current - start;
  const total = Math.abs(start - goal);
  const raw = (done / total) * 100;
  return {
    percent: Math.max(0, Math.min(100, Math.round(raw))),
    movedAway: raw < 0,
    reached: raw >= 100,
  };
}

export type PaceLabel = 'none' | 'gentle' | 'steady' | 'ambitious' | 'too_fast';

/** Classify a weekly loss rate. >0.75 kg/wk or >1% body weight/wk is "ambitious"; >1.5% is "too fast". */
export function classifyPace(kgPerWeek: number | null, currentWeightKg: number): PaceLabel {
  if (kgPerWeek == null || kgPerWeek <= 0) return 'none';
  const pct = (kgPerWeek / currentWeightKg) * 100;
  if (pct > 1.5) return 'too_fast';
  if (kgPerWeek > 0.75 || pct > 1) return 'ambitious';
  if (pct >= 0.5) return 'steady';
  return 'gentle';
}

/** Least-squares slope in kg/day over dated values. Needs >= 2 distinct dates. */
export function linearSlopePerDay(points: DatedValue[]): number | null {
  const pts = points.filter((p) => Number.isFinite(p.value) && p.value > 0);
  if (pts.length < 2) return null;
  const x0 = pts.map((p) => p.date).sort()[0];
  const xs = pts.map((p) => daysBetween(x0, p.date));
  const ys = pts.map((p) => p.value);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
