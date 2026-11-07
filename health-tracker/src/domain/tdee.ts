// Observed (data-derived) TDEE and scenario projections. Both are estimates with wide uncertainty.
import type { DailyEntry, UserProfile } from './types';
import { addDays, daysBetween } from '../lib/date';
import { ACTIVITY_MULTIPLIERS, KCAL_PER_KG, calculateBmrMifflin, effectiveNutrition, linearSlopePerDay } from './calc';

export const OBSERVED_TDEE_RULES = {
  windowDays: 28,
  minSpanDays: 21,
  minCompleteRatio: 0.8,
  minWeighIns: 8,
  excludeFirstDaysAfterStart: 7, // early water/glycogen shift distorts the trend
};

export type ObservedTdeeResult =
  | {
      ok: true;
      tdeeKcal: number;
      avgIntakeKcal: number;
      slopeKgPerWeek: number;
      completeDays: number;
      weighIns: number;
      windowStart: string;
      windowEnd: string;
    }
  | { ok: false; reason: string; completeDays: number; weighIns: number; daysNeeded: number };

export function calculateObservedTdee(days: DailyEntry[], profile: Pick<UserProfile, 'startingWeightDate'>, today: string): ObservedTdeeResult {
  const R = OBSERVED_TDEE_RULES;
  const earliestAllowed = addDays(profile.startingWeightDate, R.excludeFirstDaysAfterStart);
  const windowEnd = today;
  let windowStart = addDays(today, -(R.windowDays - 1));
  if (windowStart < earliestAllowed) windowStart = earliestAllowed;
  const span = daysBetween(windowStart, windowEnd) + 1;

  const inWindow = days.filter((d) => d.date >= windowStart && d.date <= windowEnd);
  const complete = inWindow.filter((d) => d.nutritionComplete && effectiveNutrition(d) != null);
  const weights = inWindow.filter((d) => d.weightKg && d.weightKg > 0).map((d) => ({ date: d.date, value: d.weightKg! }));

  const base = { completeDays: complete.length, weighIns: weights.length };
  if (span < R.minSpanDays) {
    return { ok: false, reason: 'span', daysNeeded: R.minSpanDays - Math.max(span, 0), ...base };
  }
  if (complete.length < Math.ceil(span * R.minCompleteRatio)) {
    return { ok: false, reason: 'complete', daysNeeded: Math.ceil(span * R.minCompleteRatio) - complete.length, ...base };
  }
  if (weights.length < R.minWeighIns) {
    return { ok: false, reason: 'weights', daysNeeded: R.minWeighIns - weights.length, ...base };
  }
  const slope = linearSlopePerDay(weights);
  if (slope == null) return { ok: false, reason: 'weights', daysNeeded: 1, ...base };
  const avgIntake = complete.reduce((s, d) => s + effectiveNutrition(d)!.caloriesKcal, 0) / complete.length;
  const tdee = avgIntake - slope * KCAL_PER_KG;
  return {
    ok: true,
    tdeeKcal: Math.round(tdee),
    avgIntakeKcal: Math.round(avgIntake),
    slopeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    completeDays: complete.length,
    weighIns: weights.length,
    windowStart,
    windowEnd,
  };
}

export interface ScenarioParams {
  id: 'optimistic' | 'middle' | 'pessimistic';
  label: string;
  activityMultiplier: number;
  intakeFactor: number; // true intake / logged intake (under-logging > 1)
  extraActivityKcal: number;
  description: string;
}

export const DEFAULT_SCENARIOS: ScenarioParams[] = [
  {
    id: 'optimistic',
    label: 'Optimis',
    activityMultiplier: 1.4,
    intakeFactor: 1,
    extraActivityKcal: 130,
    description: 'Kebutuhan energi aslimu lebih tinggi dari rumus, catatan makan akurat, jalan & latihan rutin.',
  },
  {
    id: 'middle',
    label: 'Tengah',
    activityMultiplier: ACTIVITY_MULTIPLIERS.sedentary,
    intakeFactor: 1,
    extraActivityKcal: 130,
    description: 'Rumus standar (duduk), jalan & latihan rutin, catatan makan cukup akurat.',
  },
  {
    id: 'pessimistic',
    label: 'Pesimis',
    activityMultiplier: ACTIVITY_MULTIPLIERS.sedentary,
    intakeFactor: 1.15,
    extraActivityKcal: 50,
    description: 'Sebagian makanan tidak tercatat (±15%, umum terjadi) dan jarang aktif.',
  },
];

export interface ProjectionPoint {
  date: string;
  weightKg: number;
}

export interface ScenarioResult {
  params: ScenarioParams;
  points: ProjectionPoint[]; // weekly
  weightAt: (date: string) => number | null;
}

/**
 * Day-by-day energy-balance simulation where TDEE falls as weight falls.
 * Ignores water/glycogen shifts and metabolic adaptation beyond the formula — a rough scenario, not a forecast.
 */
export function projectScenario(
  profile: Pick<UserProfile, 'sexForBmr' | 'ageYears' | 'heightCm' | 'calorieTargetKcal'>,
  startWeightKg: number,
  startDate: string,
  endDate: string,
  params: ScenarioParams,
  observedTdee?: number | null,
): ScenarioResult {
  const days = Math.max(0, daysBetween(startDate, endDate));
  const daily: number[] = [startWeightKg];
  let w = startWeightKg;
  // If observed TDEE is known, the middle scenario uses it (it already absorbs logging error and activity).
  const bmr0 = calculateBmrMifflin({ ...profile, weightKg: startWeightKg }) ?? 1;
  const observedPal = observedTdee && params.id === 'middle' ? observedTdee / bmr0 : null;
  for (let i = 1; i <= days; i++) {
    const bmr = calculateBmrMifflin({ ...profile, weightKg: w }) ?? 0;
    const tdee = observedPal ? bmr * observedPal : bmr * params.activityMultiplier + params.extraActivityKcal;
    const intake = observedPal ? profile.calorieTargetKcal : profile.calorieTargetKcal * params.intakeFactor;
    w = w - (tdee - intake) / KCAL_PER_KG;
    daily.push(w);
  }
  const points: ProjectionPoint[] = [];
  for (let i = 0; i <= days; i += 7) points.push({ date: addDays(startDate, i), weightKg: Math.round(daily[i] * 10) / 10 });
  if (days % 7 !== 0) points.push({ date: endDate, weightKg: Math.round(daily[days] * 10) / 10 });
  return {
    params,
    points,
    weightAt: (date: string) => {
      const i = daysBetween(startDate, date);
      if (i < 0 || i > days) return null;
      return Math.round(daily[i] * 10) / 10;
    },
  };
}

export function projectAllScenarios(
  profile: Pick<UserProfile, 'sexForBmr' | 'ageYears' | 'heightCm' | 'calorieTargetKcal'>,
  startWeightKg: number,
  startDate: string,
  endDate: string,
  observedTdee?: number | null,
): ScenarioResult[] {
  return DEFAULT_SCENARIOS.map((s) => projectScenario(profile, startWeightKg, startDate, endDate, s, observedTdee));
}

/** Expected weekly loss from the current plan (formula, middle scenario) at a given weight. */
export function planWeeklyLossKg(
  profile: Pick<UserProfile, 'sexForBmr' | 'ageYears' | 'heightCm' | 'calorieTargetKcal' | 'activityLevel'>,
  weightKg: number,
  observedTdee?: number | null,
): number | null {
  const bmr = calculateBmrMifflin({ ...profile, weightKg });
  if (bmr == null) return null;
  const tdee = observedTdee ?? bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
  return Math.round((((tdee - profile.calorieTargetKcal) * 7) / KCAL_PER_KG) * 100) / 100;
}
