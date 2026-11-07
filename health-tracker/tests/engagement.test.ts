import { describe, expect, it } from 'vitest';
import { buildFocus, consistencyGrid, evaluateAchievements, focusDone, logScore } from '../src/domain/engagement';
import { createDefaultProfile } from '../src/domain/defaults';
import { day } from './helpers';
import { addDays } from '../src/lib/date';

const profile = createDefaultProfile('2026-11-07T00:00:00.000Z');
const at = (h: number) => new Date(2026, 11, 4, h, 0);

describe('log score & calendar', () => {
  it('counts logged areas 0–5 and never fails on empty days', () => {
    expect(logScore(undefined)).toBe(0);
    expect(logScore(day('2026-12-01'))).toBe(0);
    expect(logScore(day('2026-12-01', { weightKg: 88, totalCaloriesKcal: 1600, sleepDurationMinutes: 360, gerdAny: false, steps: 5000 }))).toBe(5);
  });
  it('grid is Monday-aligned, 7 rows per week, future days flagged', () => {
    const g = consistencyGrid([day('2026-12-03', { weightKg: 88 })], '2026-12-03', 2);
    expect(g).toHaveLength(2);
    expect(g[1][0].date).toBe('2026-11-30'); // Monday
    expect(g[1].find((c) => c.date === '2026-12-03')!.score).toBe(1);
    expect(g[1][6].future).toBe(true);
  });
});

describe('Fokus hari ini', () => {
  it('max 3 items, positive wording, never shames', () => {
    const f = buildFocus({ today: '2026-12-04', now: at(14), day: undefined, days: [], profile });
    expect(f.length).toBeLessThanOrEqual(3);
    expect(f.map((x) => x.title).join(' ')).not.toMatch(/gagal|buruk|harus/i);
  });
  it('auto-completes the weight item once weight is logged', () => {
    const d = day('2026-12-04', { weightKg: 87 });
    const f = buildFocus({ today: '2026-12-04', now: at(8), day: d, days: [d], profile });
    const w = f.find((x) => x.id === 'weight')!;
    expect(focusDone(w, d)).toBe(true);
  });
  it('suggests remaining protein based on minimum target', () => {
    const d = day('2026-12-04', { totalCaloriesKcal: 900, totalProteinG: 60 });
    const f = buildFocus({ today: '2026-12-04', now: at(15), day: d, days: [d], profile });
    expect(f.find((x) => x.id === 'protein')!.title).toBe('Tambah ±50 g protein');
  });
  it('manual tick marks an item done', () => {
    const d = day('2026-12-04', { focusDone: ['walk'] });
    const f = buildFocus({ today: '2026-12-04', now: at(15), day: d, days: [d], profile });
    const walk = f.find((x) => x.id === 'walk');
    if (walk) expect(focusDone(walk, d)).toBe(true);
  });
});

describe('permanent achievements', () => {
  const days = Array.from({ length: 10 }, (_, i) => day(addDays('2026-11-07', i), { weightKg: 90 - i * 0.2, strengthWorkout: i % 2 === 0, sleepDurationMinutes: 400 }));
  it('earns based on totals, not streaks', () => {
    const { list, newly } = evaluateAchievements(days, profile, '2026-11-16', {});
    expect(newly).toContain('first');
    expect(newly).toContain('log7');
    expect(newly).toContain('weigh10');
    expect(newly).toContain('sleep7');
    expect(list.find((s) => s.a.id === 'strength10')!.progress).toBeCloseTo(0.5);
  });
  it('once earned, stays earned even if data no longer qualifies', () => {
    const { list, newly } = evaluateAchievements([], profile, '2026-12-01', { log7: '2026-11-13' });
    expect(newly).toHaveLength(0);
    expect(list.find((s) => s.a.id === 'log7')!.earnedAt).toBe('2026-11-13');
    expect(list.find((s) => s.a.id === 'log7')!.progress).toBe(1);
  });
});
