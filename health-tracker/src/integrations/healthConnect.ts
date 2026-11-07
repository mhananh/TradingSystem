// Android Health Connect bridge. Huawei Band data reaches Health Connect via the third-party
// "Health Sync" app (Huawei Health has no official Health Connect sync as of Nov 2026).
import { addDays, dateRange, parseDateKey, toDateKey } from '../lib/date';
import { isAndroid } from '../lib/platform';
import { getDay, saveDay, getMeta, setMeta } from '../db/db';
import type { DailyEntry } from '../domain/types';
import { mergeDeviceData, pickMainSleep } from './merge';
import type { HealthDataType } from '@capgo/capacitor-health';

const READ: HealthDataType[] = ['steps', 'sleep', 'restingHeartRate', 'heartRate', 'oxygenSaturation'];
const WRITE: HealthDataType[] = ['weight', 'dietaryEnergyConsumed'];

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

export interface HcStatus {
  supported: boolean;
  available: boolean;
  reason?: string;
  readGranted: HealthDataType[];
  writeGranted: HealthDataType[];
}

export async function getHealthConnectStatus(): Promise<HcStatus> {
  if (!isAndroid()) return { supported: false, available: false, reason: 'Hanya tersedia di aplikasi Android.', readGranted: [], writeGranted: [] };
  try {
    const H = await plugin();
    const a = await H.isAvailable();
    if (!a.available) return { supported: true, available: false, reason: a.reason ?? 'Health Connect belum terpasang/aktif.', readGranted: [], writeGranted: [] };
    const st = await H.checkAuthorization({ read: READ, write: WRITE });
    return { supported: true, available: true, readGranted: st.readAuthorized, writeGranted: st.writeAuthorized };
  } catch (e) {
    return { supported: true, available: false, reason: String((e as Error)?.message ?? e), readGranted: [], writeGranted: [] };
  }
}

export async function requestHealthConnect(includeWrite: boolean): Promise<HcStatus> {
  const H = await plugin();
  await H.requestAuthorization({ read: READ, write: includeWrite ? WRITE : [] });
  return getHealthConnectStatus();
}

export async function openHealthConnectSettings() {
  const H = await plugin();
  await H.openHealthConnectSettings();
}

const iso = (d: Date) => d.toISOString();

async function readDay(date: string) {
  const H = await plugin();
  const dayStart = parseDateKey(date);
  const dayEnd = parseDateKey(addDays(date, 1));
  const out: { steps: number | null; sleep: ReturnType<typeof pickMainSleep>; restingHr: number | null; spo2Min: number | null } = {
    steps: null,
    sleep: null,
    restingHr: null,
    spo2Min: null,
  };
  try {
    const agg = await H.queryAggregated({ dataType: 'steps', startDate: iso(dayStart), endDate: iso(dayEnd), bucket: 'day', aggregation: 'sum' });
    const total = agg.samples.reduce((s, b) => s + (b.value ?? 0), 0);
    out.steps = agg.samples.length ? Math.round(total) : null;
  } catch {
    /* permission missing or no data */
  }
  try {
    // Sleep ending on this date: look back from 12:00 the previous day.
    const from = new Date(dayStart);
    from.setHours(-12);
    const s = await H.readSamples({ dataType: 'sleep', startDate: iso(from), endDate: iso(dayEnd), limit: 50 });
    out.sleep = pickMainSleep(s.samples, date, toDateKey);
  } catch {
    /* ignore */
  }
  try {
    const r = await H.readSamples({ dataType: 'restingHeartRate', startDate: iso(dayStart), endDate: iso(dayEnd), limit: 20 });
    const last = r.samples.sort((a, b) => a.endDate.localeCompare(b.endDate)).pop();
    out.restingHr = last ? Math.round(last.value) : null;
  } catch {
    /* ignore */
  }
  try {
    const from = new Date(dayStart);
    from.setHours(-6);
    const r = await H.readSamples({ dataType: 'oxygenSaturation', startDate: iso(from), endDate: iso(dayEnd), limit: 500 });
    const vals = r.samples.map((x) => x.value).filter((v) => v > 50 && v <= 100);
    out.spo2Min = vals.length ? Math.min(...vals) : null;
  } catch {
    /* ignore */
  }
  return out;
}

export interface SyncReport {
  days: number;
  changedDays: number;
  skippedManual: number;
  error?: string;
}

/** Pull the last `lookbackDays` days from Health Connect into local daily entries. */
export async function syncFromHealthConnect(today: string, lookbackDays = 7): Promise<SyncReport> {
  const status = await getHealthConnectStatus();
  if (!status.available) return { days: 0, changedDays: 0, skippedManual: 0, error: status.reason };
  let changedDays = 0;
  let skipped = 0;
  const dates = dateRange(addDays(today, -(lookbackDays - 1)), today);
  for (const date of dates) {
    const data = await readDay(date);
    const day = await getDay(date);
    const { entry, changed, skippedManual } = mergeDeviceData(
      day,
      {
        steps: data.steps,
        sleepMinutes: data.sleep?.minutes,
        sleepStartAt: data.sleep?.sleepStartAt,
        wakeAt: data.sleep?.wakeAt,
        restingHr: data.restingHr,
        spo2Min: data.spo2Min,
      },
      'healthconnect',
    );
    skipped += skippedManual.length;
    if (changed.length) {
      changedDays++;
      await saveDay({ ...entry, hcSyncedAt: new Date().toISOString() });
    }
  }
  await setMeta('hcLastSync', new Date().toISOString());
  return { days: dates.length, changedDays, skippedManual: skipped };
}

export async function lastHealthConnectSync(): Promise<string | null> {
  return getMeta<string | null>('hcLastSync', null);
}

/** Write weight & meal energy that haven't been written yet. Avoids duplicates via per-record flags. */
export async function writeToHealthConnect(day: DailyEntry): Promise<DailyEntry> {
  const enabled = await getMeta<boolean>('hcWriteEnabled', false);
  if (!enabled || !isAndroid()) return day;
  const status = await getHealthConnectStatus();
  if (!status.available) return day;
  const H = await plugin();
  let next = day;
  if (status.writeGranted.includes('weight') && day.weightKg && day.hcWrittenWeightKg !== day.weightKg) {
    try {
      const t = parseDateKey(day.date);
      t.setHours(7, 0, 0, 0);
      await H.saveSample({ dataType: 'weight', value: day.weightKg, startDate: iso(t) });
      next = { ...next, hcWrittenWeightKg: day.weightKg };
    } catch {
      /* ignore */
    }
  }
  if (status.writeGranted.includes('dietaryEnergyConsumed')) {
    const meals = await Promise.all(
      next.meals.map(async (m) => {
        if (m.hcWritten || !(m.caloriesKcal > 0)) return m;
        try {
          const t = parseDateKey(day.date);
          const [h, mi] = (m.time ?? '12:00').split(':').map(Number);
          t.setHours(h, mi, 0, 0);
          await H.saveSample({ dataType: 'dietaryEnergyConsumed', value: m.caloriesKcal, startDate: iso(t), metadata: { name: m.name } });
          return { ...m, hcWritten: true };
        } catch {
          return m;
        }
      }),
    );
    next = { ...next, meals };
  }
  return next;
}
