import { describe, expect, it } from 'vitest';
import { parseBackup, parseNumberInput } from '../src/domain/validation';
import { createDefaultProfile } from '../src/domain/defaults';
import { day } from './helpers';

const good = () => ({
  app: 'jejak-sehat',
  schemaVersion: 1,
  exportedAt: '2026-11-07T00:00:00.000Z',
  profile: createDefaultProfile('2026-11-07T00:00:00.000Z'),
  days: [day('2026-11-07', { weightKg: 90 })],
  favorites: [],
  clinicianNotes: [],
  labResults: [{ id: 'a', date: '2026-11-01', test: 'Asam urat', value: 7.3, unit: 'mg/dL' }],
});

describe('backup import validation', () => {
  it('accepts a valid backup', () => {
    expect(parseBackup(JSON.stringify(good())).ok).toBe(true);
  });
  it('rejects malformed JSON without throwing', () => {
    expect(parseBackup('{not json')).toEqual({ ok: false, error: 'File bukan JSON yang valid.' });
  });
  it('rejects other apps', () => {
    expect(parseBackup(JSON.stringify({ app: 'x' })).ok).toBe(false);
  });
  it('rejects implausible values with a field path', () => {
    const b = good();
    b.days[0].weightKg = -5;
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/days\.0\.weightKg/);
  });
  it('rejects bad dates and duplicate dates', () => {
    const b = good();
    b.days[0].date = '2026-02-30';
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false);
    const c = good();
    c.days.push(day('2026-11-07'));
    expect(parseBackup(JSON.stringify(c))).toEqual({ ok: false, error: 'Backup berisi tanggal ganda.' });
  });
  it('rejects future schema versions', () => {
    const b = { ...good(), schemaVersion: 99 };
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false);
  });
});

describe('number input parsing', () => {
  it('accepts Indonesian decimal comma', () => {
    expect(parseNumberInput('89,6')).toBe(89.6);
    expect(parseNumberInput('')).toBeUndefined();
    expect(parseNumberInput('abc')).toBe('invalid');
  });
});
