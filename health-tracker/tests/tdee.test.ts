import { describe, expect, it } from 'vitest';
import { calculateObservedTdee, planWeeklyLossKg, projectAllScenarios } from '../src/domain/tdee';
import { createDefaultProfile } from '../src/domain/defaults';
import { syntheticLog } from './helpers';

const profile = createDefaultProfile('2026-11-07T00:00:00.000Z');

describe('observed TDEE', () => {
  it('recovers the true TDEE from consistent synthetic data', () => {
    const days = syntheticLog('2026-11-07', 40, { tdee: 2400, intake: 1700, startWeight: 90 });
    const r = calculateObservedTdee(days, profile, '2026-12-16');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.abs(r.tdeeKcal - 2400)).toBeLessThan(25);
  });
  it('refuses with too few days', () => {
    const days = syntheticLog('2026-11-07', 15, { tdee: 2400, intake: 1700, startWeight: 90 });
    const r = calculateObservedTdee(days, profile, '2026-11-21');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('span');
  });
  it('refuses when nutrition logs are mostly incomplete', () => {
    const days = syntheticLog('2026-11-07', 40, { tdee: 2400, intake: 1700, startWeight: 90, complete: false });
    const r = calculateObservedTdee(days, profile, '2026-12-16');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('complete');
  });
  it('refuses with too few weigh-ins', () => {
    const days = syntheticLog('2026-11-07', 40, { tdee: 2400, intake: 1700, startWeight: 90, weighEvery: 7 });
    const r = calculateObservedTdee(days, profile, '2026-12-16');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('weights');
  });
});

describe('projection scenarios', () => {
  const sc = projectAllScenarios(profile, 90, '2026-11-07', '2027-03-10');
  const at = (id: string) => sc.find((s) => s.params.id === id)!.weightAt('2027-03-10')!;
  it('are ordered optimistic < middle < pessimistic and plausible', () => {
    expect(at('optimistic')).toBeLessThan(at('middle'));
    expect(at('middle')).toBeLessThan(at('pessimistic'));
    // matches the evaluation: middle ≈ 80–81 kg, optimistic ≈ 75–76 kg, pessimistic ≈ 85 kg (no water shift modelled)
    expect(at('middle')).toBeGreaterThan(79);
    expect(at('middle')).toBeLessThan(82);
    expect(at('optimistic')).toBeGreaterThan(74);
    expect(at('optimistic')).toBeLessThan(77);
    expect(at('pessimistic')).toBeGreaterThan(84);
  });
  it('weekly points are monotonic for a deficit', () => {
    const pts = sc[1].points.map((p) => p.weightKg);
    for (let i = 1; i < pts.length; i++) expect(pts[i]).toBeLessThanOrEqual(pts[i - 1]);
  });
  it('weightAt returns null outside range', () => {
    expect(sc[1].weightAt('2026-01-01')).toBeNull();
  });
  it('plan weekly loss at 1700 kcal sedentary ≈ 0.47 kg/wk', () => {
    expect(planWeeklyLossKg(profile, 90)).toBeCloseTo(0.47, 2);
  });
});
