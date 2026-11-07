import type { DailyEntry } from '../src/domain/types';
import { createEmptyDay } from '../src/domain/defaults';
import { addDays } from '../src/lib/date';

export function day(date: string, patch: Partial<DailyEntry> = {}): DailyEntry {
  return { ...createEmptyDay(date, '2026-11-07T00:00:00.000Z'), ...patch };
}

/** Synthetic log: true TDEE known, constant logged intake, weights follow energy balance exactly. */
export function syntheticLog(start: string, n: number, opts: { tdee: number; intake: number; startWeight: number; weighEvery?: number; complete?: boolean }) {
  const out: DailyEntry[] = [];
  let w = opts.startWeight;
  for (let i = 0; i < n; i++) {
    const date = addDays(start, i);
    out.push(
      day(date, {
        totalCaloriesKcal: opts.intake,
        totalProteinG: 120,
        nutritionComplete: opts.complete ?? true,
        weightKg: i % (opts.weighEvery ?? 1) === 0 ? Math.round(w * 100) / 100 : undefined,
      }),
    );
    w -= (opts.tdee - opts.intake) / 7700;
  }
  return out;
}
