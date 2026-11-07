import { describe, expect, it } from 'vitest';
import { buildInsights, checkpointAdvice, coffeeBeforeFirstMeal, fastingGerdInsight, summarizeWeek } from '../src/domain/insights';
import { createDefaultProfile } from '../src/domain/defaults';
import { day } from './helpers';
import { addDays } from '../src/lib/date';
import { fastFromClockTimes } from '../src/domain/calc';

const profile = createDefaultProfile('2026-11-07T00:00:00.000Z');

describe('insights', () => {
  it('reports insufficient data instead of guessing', () => {
    const r = buildInsights([], profile, '2026-11-20', null);
    expect(r.every((i) => i.status === 'insufficient')).toBe(true);
    expect(r.every((i) => i.needed)).toBe(true);
  });

  it('fasting vs GERD needs ≥5 days per group and uses cautious language', () => {
    const today = '2026-12-31';
    const days = Array.from({ length: 12 }, (_, i) => {
      const date = addDays(today, -i);
      const long = i % 2 === 0;
      const f = fastFromClockTimes(date, long ? '19:00' : '23:00', long ? '10:00' : '08:00')!;
      return day(date, { fastingStartAt: f.fastingStartAt, fastingEndAt: f.fastingEndAt, gerdAny: long });
    });
    const r = fastingGerdInsight(days, today);
    expect(r.status).toBe('ready');
    expect(r.text).toMatch(/mungkin berkaitan/);
    expect(r.text).not.toMatch(/menyebabkan|penyebab utama/);
  });

  it('weekly summary treats missing data as missing, not zero', () => {
    const s = summarizeWeek([day('2026-11-09', { weightKg: 89 })], '2026-11-09', 110);
    expect(s.avgKcal).toBeNull();
    expect(s.avgSleepMin).toBeNull();
    expect(s.avgWeight).toBe(89);
    expect(s.loggedDays).toBe(1);
  });

  it('coffee before first meal is detected from fast end time', () => {
    const f = fastFromClockTimes('2026-11-10', '19:30', '09:30')!;
    expect(coffeeBeforeFirstMeal(day('2026-11-10', { coffeeCups: 1, coffeeTime: '07:00', fastingStartAt: f.fastingStartAt, fastingEndAt: f.fastingEndAt }))).toBe(true);
    expect(coffeeBeforeFirstMeal(day('2026-11-10', { coffeeCups: 1, coffeeTime: '10:00', fastingStartAt: f.fastingStartAt, fastingEndAt: f.fastingEndAt }))).toBe(false);
    expect(coffeeBeforeFirstMeal(day('2026-11-10', { coffeeCups: 0 }))).toBeNull();
  });

  it('checkpoint: slow progress checks behaviours before suggesting less food, never below floor', () => {
    const cp = checkpointAdvice([], profile, '2026-12-20', 0.2);
    expect(cp.kind).toBe('slow');
    expect(cp.steps[0]).toMatch(/catatan/i);
    expect(cp.steps[cp.steps.length - 1]).toMatch(/1500/);
    expect(checkpointAdvice([], profile, '2026-11-20', 0.2).due).toBe(false);
    expect(checkpointAdvice([], profile, '2026-12-20', 1.3).kind).toBe('fast');
  });
});
