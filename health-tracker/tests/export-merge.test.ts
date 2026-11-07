import { describe, expect, it } from 'vitest';
import { dailyCsv, mealsCsv } from '../src/lib/export';
import { mergeDeviceData, pickMainSleep } from '../src/integrations/merge';
import { guardAdvice, sanitizeFood, sanitizeScreenshot } from '../src/ai/schemas';
import { day } from './helpers';
import { toDateKey } from '../src/lib/date';

describe('CSV export', () => {
  it('has BOM, header, empty cells for missing data, decimal comma with ; separator', () => {
    const csv = dailyCsv([day('2026-11-08', { weightKg: 89.6 }), day('2026-11-07', { totalCaloriesKcal: 1700, nutritionComplete: true, notes: 'lembur; capek "banget"' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0].startsWith('tanggal;berat_kg')).toBe(true);
    expect(lines[1].startsWith('2026-11-07;;;1700')).toBe(true); // sorted, missing weight is empty
    expect(lines[1]).toContain('"lembur; capek ""banget"""');
    expect(lines[2].startsWith('2026-11-08;89,6;')).toBe(true);
  });
  it('standard comma CSV uses decimal points', () => {
    expect(dailyCsv([day('2026-11-08', { weightKg: 89.6 })], ',')).toContain('2026-11-08,89.6,');
  });
  it('meals CSV lists each meal', () => {
    const csv = mealsCsv([day('2026-11-07', { meals: [{ id: '1', name: 'Nasi', caloriesKcal: 150, proteinG: 3, carbsG: 34, fatG: 0.3, estimate: true, source: 'library' }] })]);
    expect(csv).toContain('2026-11-07;;Nasi;;150;3;34;0,3;ya;library');
  });
});

describe('device data merge', () => {
  it('fills empty fields and never overwrites manual values', () => {
    const r = mergeDeviceData(day('2026-11-08', { steps: 4000, stepsSource: 'manual' }), { steps: 6500, sleepMinutes: 350, restingHr: 72 }, 'healthconnect');
    expect(r.entry.steps).toBe(4000);
    expect(r.skippedManual).toContain('langkah');
    expect(r.entry.sleepDurationMinutes).toBe(350);
    expect(r.entry.sleepSource).toBe('healthconnect');
    expect(r.entry.restingHr).toBe(72);
  });
  it('refreshes previously device-sourced values', () => {
    const r = mergeDeviceData(day('2026-11-08', { steps: 3000, stepsSource: 'healthconnect' }), { steps: 6500 }, 'healthconnect');
    expect(r.entry.steps).toBe(6500);
    expect(r.changed).toContain('langkah');
  });
  it('picks the longest sleep session ending on the wake date and excludes awake stages', () => {
    const s = pickMainSleep(
      [
        { startDate: '2026-11-07T23:00:00', endDate: '2026-11-08T05:30:00', stages: [{ stage: 'light', durationMinutes: 300 }, { stage: 'awake', durationMinutes: 30 }, { stage: 'deep', durationMinutes: 60 }] },
        { startDate: '2026-11-08T13:00:00', endDate: '2026-11-08T13:30:00' },
        { startDate: '2026-11-06T23:00:00', endDate: '2026-11-07T06:00:00' },
      ],
      '2026-11-08',
      toDateKey,
    )!;
    expect(s.minutes).toBe(360);
  });
});

describe('AI output guards', () => {
  it('drops advice below the calorie floor or extending fasting', () => {
    const kept = guardAdvice(
      [
        { title: 'Turunkan ke 1.200 kkal', detail: 'agar cepat' },
        { title: 'Coba 16:8', detail: 'puasa lebih lama' },
        { title: 'Tambah 1.000 langkah', detail: 'setelah makan siang' },
        { title: 'Tetap 1.700 kkal', detail: 'fokus protein' },
      ],
      1500,
    );
    expect(kept.map((k) => k.title)).toEqual(['Tambah 1.000 langkah', 'Tetap 1.700 kkal']);
  });
  it('clamps food numbers and keeps min ≤ value ≤ max', () => {
    const r = sanitizeFood({
      is_food: true,
      confidence: 'low',
      assumptions: [],
      questions: [{ question: 'a', options: ['1'] }, { question: 'b', options: [] }, { question: 'c', options: [] }],
      gerd_note: null,
      items: [{ name: 'x', portion: 'y', kcal: 500, kcal_min: 600, kcal_max: 100, protein_g: -3, carbs_g: 10, fat_g: 99999 }],
    });
    expect(r.items[0]).toMatchObject({ kcal: 500, kcal_min: 500, kcal_max: 500, protein_g: 0, fat_g: 300 });
    expect(r.questions).toHaveLength(2);
  });
  it('drops implausible screenshot values', () => {
    const r = sanitizeScreenshot({ readable: true, date_shown: 'kemarin', sleep_total_minutes: 5000, bedtime: '23:10', wake_time: '25:00', steps: 6000, resting_hr: 300, spo2_min: 93, sleep_score: 80 });
    expect(r).toMatchObject({ date_shown: null, sleep_total_minutes: null, bedtime: '23:10', wake_time: null, steps: 6000, resting_hr: null, spo2_min: 93 });
  });
});
