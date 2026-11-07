// Pure merge rules for imported device data (Health Connect / screenshot).
// Manual entries are never silently overwritten; device-sourced values may be refreshed.
import type { DailyEntry, DataSource } from '../domain/types';

export interface DeviceDayData {
  steps?: number | null;
  sleepStartAt?: string | null;
  wakeAt?: string | null;
  sleepMinutes?: number | null;
  restingHr?: number | null;
  spo2Min?: number | null;
}

export interface MergeResult {
  entry: DailyEntry;
  changed: string[];
  skippedManual: string[];
}

const canWrite = (current: unknown, source: DataSource | undefined) => current == null || source !== 'manual';

export function mergeDeviceData(day: DailyEntry, data: DeviceDayData, source: Exclude<DataSource, 'manual'>): MergeResult {
  const e: DailyEntry = { ...day };
  const changed: string[] = [];
  const skippedManual: string[] = [];

  if (data.steps != null && data.steps >= 0) {
    if (canWrite(e.steps, e.stepsSource)) {
      if (e.steps !== data.steps) changed.push('langkah');
      e.steps = Math.round(data.steps);
      e.stepsSource = source;
    } else skippedManual.push('langkah');
  }
  if (data.sleepMinutes != null && data.sleepMinutes > 0) {
    if (canWrite(e.sleepDurationMinutes, e.sleepSource)) {
      if (e.sleepDurationMinutes !== data.sleepMinutes) changed.push('tidur');
      e.sleepDurationMinutes = Math.round(data.sleepMinutes);
      if (data.sleepStartAt) e.sleepStartAt = data.sleepStartAt;
      if (data.wakeAt) e.wakeAt = data.wakeAt;
      e.sleepSource = source;
    } else skippedManual.push('tidur');
  }
  if (data.restingHr != null && data.restingHr > 0) {
    if (canWrite(e.restingHr, e.restingHrSource)) {
      if (e.restingHr !== data.restingHr) changed.push('nadi istirahat');
      e.restingHr = Math.round(data.restingHr);
      e.restingHrSource = source;
    } else skippedManual.push('nadi istirahat');
  }
  if (data.spo2Min != null && data.spo2Min > 0 && e.spo2Min == null) {
    e.spo2Min = Math.round(data.spo2Min);
    changed.push('SpO2');
  }
  return { entry: e, changed, skippedManual };
}

export interface SleepSampleLike {
  startDate: string;
  endDate: string;
  sleepState?: string;
  stages?: { stage: string; durationMinutes: number }[];
}

/**
 * Choose the main sleep session that ENDS on `wakeDateKey` (local) and compute minutes asleep.
 * Uses stage data when available (excluding awake/inBed), else end - start.
 */
export function pickMainSleep(samples: SleepSampleLike[], wakeDateKey: string, toDateKey: (d: Date) => string) {
  const sessions = samples
    .filter((s) => toDateKey(new Date(s.endDate)) === wakeDateKey)
    .map((s) => {
      const span = Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000);
      const asleep = s.stages?.length
        ? s.stages.filter((st) => st.stage !== 'awake' && st.stage !== 'inBed').reduce((t, st) => t + st.durationMinutes, 0)
        : s.sleepState === 'awake' || s.sleepState === 'inBed'
          ? 0
          : span;
      return { ...s, span, asleep };
    })
    .filter((s) => s.span > 0 && s.span <= 24 * 60);
  if (!sessions.length) return null;
  const main = sessions.sort((a, b) => b.span - a.span)[0];
  return { sleepStartAt: new Date(main.startDate).toISOString(), wakeAt: new Date(main.endDate).toISOString(), minutes: Math.round(main.asleep || main.span) };
}
