import { describe, expect, it } from 'vitest';
import { dayPart, todayMessage } from '../src/domain/today';
import { createDefaultProfile } from '../src/domain/defaults';
import { day } from './helpers';

const profile = createDefaultProfile('2026-11-07T00:00:00.000Z');
const at = (h: number) => new Date(2026, 11, 4, h, 0);

describe('Hari ini message', () => {
  it('day parts', () => {
    expect(dayPart(at(7))).toBe('pagi');
    expect(dayPart(at(13))).toBe('siang');
    expect(dayPart(at(16))).toBe('sore');
    expect(dayPart(at(21))).toBe('malam');
  });
  it('morning without sleep asks for sleep first', () => {
    const m = todayMessage({ now: at(7), today: undefined, lastNight: undefined, recent: [], profile });
    expect(m.action.kind).toBe('sleep');
  });
  it('short sleep → gentle message, never shaming', () => {
    const d = day('2026-12-04', { sleepDurationMinutes: 320 });
    const m = todayMessage({ now: at(7), today: d, lastNight: d, recent: [d], profile });
    expect(m.body).toMatch(/pelan-pelan/);
    expect(`${m.headline} ${m.body}`).not.toMatch(/gagal|buruk sekali|harus/i);
  });
  it('fasting symptoms override everything with a care message', () => {
    const d = day('2026-12-04', { fastingSymptoms: ['dizzy'], totalCaloriesKcal: 1500, totalProteinG: 120 });
    const m = todayMessage({ now: at(13), today: d, lastNight: d, recent: [d], profile });
    expect(m.tone).toBe('care');
    expect(m.body).toMatch(/berhenti puasa/);
  });
  it('midday protein gap names the gap and covers the protein focus item', () => {
    const d = day('2026-12-04', { totalCaloriesKcal: 800, totalProteinG: 61 });
    const m = todayMessage({ now: at(13), today: d, lastNight: d, recent: [d], profile });
    expect(m.headline).toBe('Protein kurang ±49 g.');
    expect(m.covers).toBe('protein');
  });
});
