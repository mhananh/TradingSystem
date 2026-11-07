import { describe, expect, it } from 'vitest';
import {
  calculateBmi, calculateBmrMifflin, calculateDailyNutritionTotals, calculateFastingDuration, calculateGoalProgressPercent,
  calculateMacroCalories, calculateRequiredWeeklyRate, calculateRollingAverage, calculateSleepDuration, calculateTdee,
  calculateWeightChange, classifyPace, effectiveNutrition, fastFromClockTimes, linearSlopePerDay, sleepFromClockTimes, ACTIVITY_MULTIPLIERS,
} from '../src/domain/calc';
import { createDefaultProfile } from '../src/domain/defaults';
import { addDays, daysBetween } from '../src/lib/date';

const p = createDefaultProfile('2026-11-07T00:00:00.000Z');

describe('BMR / TDEE / BMI for the initial profile', () => {
  it('matches the brief: BMR 1850, sedentary TDEE 2220, BMI 30.4', () => {
    const bmr = calculateBmrMifflin({ ...p, weightKg: p.startingWeightKg });
    expect(bmr).toBe(1850);
    expect(calculateTdee(bmr, ACTIVITY_MULTIPLIERS.sedentary)).toBe(2220);
    expect(calculateBmi(90, 172)).toBe(30.4);
  });
  it('uses -161 for female', () => {
    expect(calculateBmrMifflin({ sexForBmr: 'female', ageYears: 26, heightCm: 172, weightKg: 90 })).toBe(1684);
  });
  it('returns null on malformed input instead of throwing', () => {
    expect(calculateBmrMifflin({ sexForBmr: 'male', ageYears: 26, heightCm: 172, weightKg: NaN })).toBeNull();
    expect(calculateBmrMifflin({ sexForBmr: 'male', ageYears: -1, heightCm: 172, weightKg: 90 })).toBeNull();
    expect(calculateTdee(null, 1.2)).toBeNull();
    expect(calculateBmi(0, 172)).toBeNull();
  });
});

describe('macros', () => {
  it('initial targets ≈ 1699 kcal', () => {
    const m = calculateMacroCalories({ proteinG: 130, fatG: 55, carbsG: 171 });
    expect(m).toEqual({ protein: 520, carbs: 684, fat: 495, total: 1699 });
  });
  it('ignores negative / NaN macros', () => {
    expect(calculateMacroCalories({ proteinG: -10, carbsG: NaN, fatG: 10 }).total).toBe(90);
  });
  it('meals add up', () => {
    const t = calculateDailyNutritionTotals([
      { caloriesKcal: 150, proteinG: 3, carbsG: 34, fatG: 0.3 },
      { caloriesKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      { caloriesKcal: 120, proteinG: 0, carbsG: 0, fatG: 13.6 },
    ]);
    expect(t).toEqual({ caloriesKcal: 435, proteinG: 34, carbsG: 34, fatG: 17.5 });
  });
  it('effectiveNutrition: meals win, quick totals next, nothing → null (not zero)', () => {
    expect(effectiveNutrition({ meals: [], totalCaloriesKcal: undefined })).toBeNull();
    expect(effectiveNutrition({ meals: [], totalCaloriesKcal: 1600, totalProteinG: 100 })?.caloriesKcal).toBe(1600);
    expect(
      effectiveNutrition({ meals: [{ caloriesKcal: 500, proteinG: 30, carbsG: 50, fatG: 10 } as never], totalCaloriesKcal: 9999 })?.caloriesKcal,
    ).toBe(500);
  });
});

describe('sleep & fasting durations', () => {
  it('sleep across midnight is attributed to the wake date', () => {
    const s = sleepFromClockTimes('2026-11-08', '23:30', '05:30')!;
    expect(s.minutes).toBe(360);
    expect(new Date(s.sleepStartAt).getDate()).toBe(7);
    expect(new Date(s.wakeAt).getDate()).toBe(8);
  });
  it('sleep after midnight stays on the same day', () => {
    expect(sleepFromClockTimes('2026-11-08', '00:45', '06:15')!.minutes).toBe(330);
  });
  it('fast 19:30 → 09:30 = 14 h, attributed to end date', () => {
    const f = fastFromClockTimes('2026-11-08', '19:30', '09:30')!;
    expect(f.minutes).toBe(840);
    expect(new Date(f.fastingEndAt).getDate()).toBe(8);
  });
  it('Ramadan-style same-day fast (04:30 → 18:00)', () => {
    expect(fastFromClockTimes('2027-02-10', '04:30', '18:00')!.minutes).toBe(810);
  });
  it('rejects invalid / reversed / absurd ranges', () => {
    expect(calculateSleepDuration('2026-11-08T06:00:00Z', '2026-11-08T05:00:00Z')).toBeNull();
    expect(calculateSleepDuration('nope', '2026-11-08T05:00:00Z')).toBeNull();
    expect(calculateFastingDuration('2026-11-01T00:00:00Z', '2026-11-08T00:00:00Z')).toBeNull();
    expect(calculateFastingDuration(undefined, '2026-11-08T00:00:00Z')).toBeNull();
    expect(sleepFromClockTimes('2026-11-08', '25:00', '06:00')).toBeNull();
  });
  it('timestamps spanning a DST shift are measured in real elapsed time', () => {
    // Explicit offsets: a 7h night where the clock moved by 1h.
    expect(calculateSleepDuration('2026-03-28T23:00:00+01:00', '2026-03-29T07:00:00+02:00')).toBe(420);
  });
});

describe('rolling average', () => {
  it('ignores missing dates and never treats them as zero', () => {
    const pts = [
      { date: '2026-11-07', value: 90 },
      { date: '2026-11-08', value: 89.6 },
      { date: '2026-11-11', value: 89.2 },
      { date: '2026-11-13', value: 89.0 },
    ];
    const r = calculateRollingAverage(pts, 7, 3);
    expect(r[0].average).toBeNull();
    expect(r[1].average).toBeNull();
    expect(r[2].average).toBeCloseTo((90 + 89.6 + 89.2) / 3, 2);
    // 2026-11-07 is 6 days before 11-13 → still inside the 7-day window
    expect(r[3].average).toBeCloseTo((90 + 89.6 + 89.2 + 89.0) / 4, 2);
  });
  it('window excludes points older than windowDays', () => {
    const r = calculateRollingAverage([{ date: '2026-11-01', value: 95 }, { date: '2026-11-10', value: 90 }, { date: '2026-11-11', value: 90 }, { date: '2026-11-12', value: 90 }]);
    expect(r[3].average).toBe(90);
  });
  it('drops non-positive / NaN values', () => {
    expect(calculateRollingAverage([{ date: '2026-11-01', value: 0 }, { date: '2026-11-02', value: NaN }])).toEqual([]);
  });
});

describe('goal pace & progress', () => {
  it('required weekly rate 90→75 by estimated Eid 2027 ≈ 0.85 kg/wk', () => {
    const r = calculateRequiredWeeklyRate(90, 75, '2027-03-10', '2026-11-07')!;
    expect(r).toBeGreaterThan(0.84);
    expect(r).toBeLessThan(0.87);
    expect(classifyPace(r, 90)).toBe('ambitious');
  });
  it('past target date → null', () => {
    expect(calculateRequiredWeeklyRate(90, 75, '2026-01-01', '2026-11-07')).toBeNull();
  });
  it('pace classes', () => {
    expect(classifyPace(0.3, 90)).toBe('gentle');
    expect(classifyPace(0.6, 90)).toBe('steady');
    expect(classifyPace(1.5, 90)).toBe('too_fast');
    expect(classifyPace(-0.2, 90)).toBe('none');
  });
  it('progress handles moving away from goal', () => {
    expect(calculateGoalProgressPercent(90, 82.5, 75)).toEqual({ percent: 50, movedAway: false, reached: false });
    expect(calculateGoalProgressPercent(90, 91, 75)).toEqual({ percent: 0, movedAway: true, reached: false });
    expect(calculateGoalProgressPercent(90, 74, 75)).toEqual({ percent: 100, movedAway: false, reached: true });
    expect(calculateGoalProgressPercent(90, 90, 90)).toBeNull();
  });
  it('weight change', () => {
    expect(calculateWeightChange(90, 88.7)).toBe(-1.3);
    expect(calculateWeightChange(90, NaN)).toBeNull();
  });
  it('linear slope', () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({ date: addDays('2026-11-07', i), value: 90 - 0.1 * i }));
    expect(linearSlopePerDay(pts)).toBeCloseTo(-0.1, 6);
    expect(linearSlopePerDay([{ date: '2026-11-07', value: 90 }])).toBeNull();
  });
  it('daysBetween is DST-safe', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-11-07', '2027-03-10')).toBe(123);
  });
});
