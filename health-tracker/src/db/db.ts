import Dexie, { type EntityTable } from 'dexie';
import type { AiUsageRecord, BackupFile, ClinicianNote, DailyEntry, FavoriteMeal, LabResult, MetaRecord, UserProfile } from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import { createEmptyDay } from '../domain/defaults';

export class JejakDb extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  days!: EntityTable<DailyEntry, 'date'>;
  favorites!: EntityTable<FavoriteMeal, 'id'>;
  clinicianNotes!: EntityTable<ClinicianNote, 'id'>;
  labResults!: EntityTable<LabResult, 'id'>;
  aiUsage!: EntityTable<AiUsageRecord, 'id'>;
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor(name = 'jejak-sehat') {
    super(name);
    // v1 schema. Future changes: add this.version(2).stores({...}).upgrade(tx => ...)
    this.version(1).stores({
      profile: 'id',
      days: 'date',
      favorites: 'id, name',
      clinicianNotes: 'id, createdAt',
      labResults: 'id, date',
      aiUsage: 'id, at',
      meta: 'key',
    });
  }
}

export const db = new JejakDb();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDay(date: string): Promise<DailyEntry> {
  return (await db.days.get(date)) ?? createEmptyDay(date);
}

/** Upsert one record per date (PK = date) — duplicates are impossible by construction. */
export async function saveDay(entry: DailyEntry): Promise<void> {
  await db.days.put({ ...entry, updatedAt: new Date().toISOString() });
}

export async function deleteDay(date: string): Promise<DailyEntry | undefined> {
  const prev = await db.days.get(date);
  await db.days.delete(date);
  return prev;
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const r = await db.meta.get(key);
  return r ? (r.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function exportAll(): Promise<BackupFile> {
  const [profile, days, favorites, clinicianNotes, labResults] = await Promise.all([
    db.profile.get('me'),
    db.days.orderBy('date').toArray(),
    db.favorites.toArray(),
    db.clinicianNotes.toArray(),
    db.labResults.toArray(),
  ]);
  return {
    app: 'jejak-sehat',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    days,
    favorites,
    clinicianNotes,
    labResults,
  };
}

export interface ImportPreview {
  days: number;
  firstDate: string | null;
  lastDate: string | null;
  conflicts: number; // dates already present locally
  hasProfile: boolean;
  favorites: number;
  labResults: number;
  clinicianNotes: number;
}

export async function previewImport(data: BackupFile): Promise<ImportPreview> {
  const dates = data.days.map((d) => d.date).sort();
  const existing = await db.days.bulkGet(dates);
  return {
    days: dates.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    conflicts: existing.filter(Boolean).length,
    hasProfile: !!data.profile,
    favorites: data.favorites.length,
    labResults: data.labResults.length,
    clinicianNotes: data.clinicianNotes.length,
  };
}

/** mode "merge": backup wins on conflicting dates, other local data kept. mode "replace": wipe then load. */
export async function applyImport(data: BackupFile, mode: 'merge' | 'replace'): Promise<void> {
  await db.transaction('rw', [db.profile, db.days, db.favorites, db.clinicianNotes, db.labResults], async () => {
    if (mode === 'replace') {
      await Promise.all([db.profile.clear(), db.days.clear(), db.favorites.clear(), db.clinicianNotes.clear(), db.labResults.clear()]);
    }
    if (data.profile) await db.profile.put({ ...data.profile, schemaVersion: SCHEMA_VERSION });
    await db.days.bulkPut(data.days);
    await db.favorites.bulkPut(data.favorites);
    await db.clinicianNotes.bulkPut(data.clinicianNotes);
    await db.labResults.bulkPut(data.labResults);
  });
}

export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', [db.profile, db.days, db.favorites, db.clinicianNotes, db.labResults, db.aiUsage, db.meta], async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
