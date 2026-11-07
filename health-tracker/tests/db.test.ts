import { describe, expect, it, beforeEach } from 'vitest';
import { applyImport, db, deleteAllData, exportAll, previewImport, saveDay } from '../src/db/db';
import { parseBackup } from '../src/domain/validation';
import { day } from './helpers';

beforeEach(async () => {
  await deleteAllData();
});

describe('local database', () => {
  it('stores exactly one record per date (no duplicates)', async () => {
    await saveDay(day('2026-11-08', { weightKg: 90 }));
    await saveDay(day('2026-11-08', { weightKg: 89.5 }));
    expect(await db.days.count()).toBe(1);
    expect((await db.days.get('2026-11-08'))?.weightKg).toBe(89.5);
  });

  it('export → wipe → import restores data; merge keeps local non-conflicting days', async () => {
    await saveDay(day('2026-11-08', { weightKg: 90 }));
    await saveDay(day('2026-11-09', { weightKg: 89.8 }));
    const backup = await exportAll();
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    await deleteAllData();
    await saveDay(day('2026-11-10', { weightKg: 89.5 }));
    if (!parsed.ok) return;
    const prev = await previewImport(parsed.data);
    expect(prev).toMatchObject({ days: 2, conflicts: 0 });
    await applyImport(parsed.data, 'merge');
    expect(await db.days.count()).toBe(3);
    await applyImport(parsed.data, 'replace');
    expect(await db.days.count()).toBe(2);
  });
});
