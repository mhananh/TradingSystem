import type { DailyEntry, UserProfile } from './types';
import { addDays, daysBetween } from '../lib/date';
import { calculateRollingAverage } from './calc';

export function latestWeight(days: DailyEntry[]): { date: string; value: number } | null {
  for (let i = days.length - 1; i >= 0; i--) if (days[i].weightKg) return { date: days[i].date, value: days[i].weightKg! };
  return null;
}

export function weightPoints(days: DailyEntry[]) {
  return days.filter((d) => d.weightKg).map((d) => ({ date: d.date, value: d.weightKg! }));
}

/** Latest 7-day rolling average (needs ≥3 weigh-ins in the window), else null. */
export function currentTrendWeight(days: DailyEntry[]): number | null {
  const r = calculateRollingAverage(weightPoints(days));
  const last = r[r.length - 1];
  return last?.average ?? null;
}

/** Best estimate of "current weight": rolling average if available, else latest weigh-in, else start. */
export function currentWeightEstimate(days: DailyEntry[], profile: UserProfile): number {
  return currentTrendWeight(days) ?? latestWeight(days)?.value ?? profile.startingWeightKg;
}

export type TrendDir = 'down' | 'flat' | 'up' | 'unknown';

/** Compare this 7-day average vs previous 7-day average (each needs ≥2 weigh-ins). */
export function weeklyTrend(days: DailyEntry[], today: string): { thisAvg: number | null; prevAvg: number | null; dir: TrendDir; delta: number | null } {
  const avgOf = (s: string, e: string) => {
    const v = days.filter((d) => d.date >= s && d.date <= e && d.weightKg).map((d) => d.weightKg!);
    return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const thisAvg = avgOf(addDays(today, -6), today);
  const prevAvg = avgOf(addDays(today, -13), addDays(today, -7));
  if (thisAvg == null || prevAvg == null) return { thisAvg, prevAvg, dir: 'unknown', delta: null };
  const delta = Math.round((thisAvg - prevAvg) * 10) / 10;
  return { thisAvg: Math.round(thisAvg * 10) / 10, prevAvg: Math.round(prevAvg * 10) / 10, dir: Math.abs(delta) < 0.2 ? 'flat' : delta < 0 ? 'down' : 'up', delta };
}

export function daysSinceStart(profile: UserProfile, today: string) {
  return Math.max(0, daysBetween(profile.startingWeightDate, today));
}

export function isRamadanDay(profile: UserProfile, date: string) {
  return profile.ramadanEnabled && date >= profile.ramadanStart && date <= profile.ramadanEnd;
}
