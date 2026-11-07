import { z } from 'zod';
import { isDateKey, isTimeHHmm } from '../lib/date';
import { SCHEMA_VERSION, type BackupFile } from './types';

const dateKey = z.string().refine(isDateKey, 'Tanggal harus berformat YYYY-MM-DD');
const hhmm = z.string().refine(isTimeHHmm, 'Jam harus berformat JJ:MM');
const iso = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), 'Waktu tidak valid');
const nonNeg = z.number().finite().min(0);
const scale = z.number().int().min(1).max(5);

export const LIMITS = {
  weightKg: [30, 300],
  heightCm: [120, 230],
  ageYears: [14, 100],
  waistCm: [40, 200],
  kcalPerDay: [0, 10000],
  steps: [0, 100000],
  restingHr: [30, 130],
  spo2: [70, 100],
} as const;

const between = (lo: number, hi: number) => z.number().finite().min(lo).max(hi);

export const mealSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  time: hhmm.optional(),
  portionDescription: z.string().max(200).optional(),
  caloriesKcal: between(0, 5000),
  proteinG: between(0, 500),
  carbsG: between(0, 1000),
  fatG: between(0, 500),
  estimate: z.boolean(),
  source: z.enum(['manual', 'library', 'favorite', 'ai-photo', 'ai-label', 'ai-menu']).catch('manual'),
  ai: z
    .object({
      provider: z.enum(['claude', 'gemini']),
      model: z.string(),
      kcalMin: nonNeg,
      kcalMax: nonNeg,
      confidence: z.enum(['low', 'medium', 'high']),
      assumptions: z.array(z.string()),
    })
    .optional(),
  hcWritten: z.boolean().optional(),
});

export const gerdEpisodeSchema = z.object({
  id: z.string().min(1),
  time: hhmm.optional(),
  severity: z.enum(['mild', 'moderate', 'severe']),
  symptoms: z.array(z.string()),
  context: z.array(z.string()),
  triggers: z.array(z.string()),
  duringFast: z.boolean().optional(),
  note: z.string().max(1000).optional(),
});

export const dailyEntrySchema = z.object({
  date: dateKey,
  weightKg: between(...LIMITS.weightKg).optional(),
  weightStandardCondition: z.boolean().optional(),
  waistCm: between(...LIMITS.waistCm).optional(),
  meals: z.array(mealSchema).default([]),
  totalCaloriesKcal: between(...LIMITS.kcalPerDay).optional(),
  totalProteinG: between(0, 1000).optional(),
  totalCarbsG: between(0, 2000).optional(),
  totalFatG: between(0, 1000).optional(),
  nutritionComplete: z.boolean().optional(),
  fastingStartAt: iso.optional(),
  fastingEndAt: iso.optional(),
  fastingSymptoms: z.array(z.string()).optional(),
  ramadanFast: z.boolean().optional(),
  sleepStartAt: iso.optional(),
  wakeAt: iso.optional(),
  sleepDurationMinutes: between(0, 1440).optional(),
  sleepSource: z.enum(['manual', 'healthconnect', 'screenshot']).optional(),
  sleepQuality1to5: scale.optional(),
  awakenings: between(0, 50).optional(),
  morningRestedness: z.enum(['refreshed', 'okay', 'tired', 'very_tired']).optional(),
  breathingObserved: z.array(z.string()).optional(),
  napMinutes: between(0, 600).optional(),
  sleepinessMorning1to5: scale.optional(),
  sleepinessAfterLunch1to5: scale.optional(),
  sleepinessAfternoon1to5: scale.optional(),
  energy1to5: scale.optional(),
  coffeeCups: between(0, 20).optional(),
  coffeeTime: hhmm.optional(),
  gerdAny: z.boolean().optional(),
  gerdEpisodes: z.array(gerdEpisodeSchema).default([]),
  steps: between(...LIMITS.steps).optional(),
  stepsSource: z.enum(['manual', 'healthconnect', 'screenshot']).optional(),
  walkingMinutes: between(0, 1440).optional(),
  strengthWorkout: z.boolean().optional(),
  strengthLogs: z
    .array(z.object({ exerciseId: z.string(), level: z.number().int().min(0).max(20), sets: between(0, 20), reps: between(0, 200) }))
    .optional(),
  exerciseMinutes: between(0, 1440).optional(),
  exerciseType: z.string().max(200).optional(),
  effort: z.enum(['easy', 'moderate', 'hard']).optional(),
  easyDay: z.boolean().optional(),
  restingHr: between(...LIMITS.restingHr).optional(),
  restingHrSource: z.enum(['manual', 'healthconnect', 'screenshot']).optional(),
  spo2Min: between(...LIMITS.spo2).optional(),
  hcSyncedAt: iso.optional(),
  hcWrittenWeightKg: between(...LIMITS.weightKg).optional(),
  waterGlasses: between(0, 40).optional(),
  focusDone: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional(),
  updatedAt: iso,
});

export const profileSchema = z.object({
  id: z.literal('me'),
  schemaVersion: z.number().int(),
  displayName: z.string().max(40).optional(),
  sexForBmr: z.enum(['male', 'female']),
  ageYears: between(...LIMITS.ageYears),
  heightCm: between(...LIMITS.heightCm),
  startingWeightKg: between(...LIMITS.weightKg),
  startingWeightDate: dateKey,
  goalWeightKg: between(...LIMITS.weightKg),
  secondaryGoalWeightKg: between(...LIMITS.weightKg).optional(),
  targetDate: dateKey.optional(),
  checkpointWeightKg: between(...LIMITS.weightKg).optional(),
  checkpointDate: dateKey.optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'high']),
  calorieTargetKcal: between(800, 6000),
  calorieFloorKcal: between(800, 4000),
  proteinTargetG: between(0, 400),
  proteinMinG: between(0, 400),
  fatTargetG: between(0, 300),
  carbTargetG: between(0, 800),
  stepGoal: between(0, 50000),
  sleepTargetHours: between(4, 12),
  bedtimeTarget: hhmm.optional(),
  fastingEnabled: z.boolean(),
  eatingWindowStart: hhmm,
  eatingWindowEnd: hhmm,
  ramadanEnabled: z.boolean(),
  ramadanStart: dateKey,
  ramadanEnd: dateKey,
  baselineWaistCm: between(...LIMITS.waistCm).optional(),
  baselineNeckCm: between(20, 80).optional(),
  baselineNotes: z.string().max(5000),
  onboardingCompletedAt: iso.optional(),
  createdAt: iso,
  updatedAt: iso,
});

export const backupSchema = z.object({
  app: z.literal('jejak-sehat'),
  schemaVersion: z.number().int().min(1).max(SCHEMA_VERSION),
  exportedAt: iso,
  profile: profileSchema.nullable(),
  days: z.array(dailyEntrySchema),
  favorites: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      portionDescription: z.string().optional(),
      caloriesKcal: nonNeg,
      proteinG: nonNeg,
      carbsG: nonNeg,
      fatG: nonNeg,
      estimate: z.boolean(),
      createdAt: iso,
    }),
  ),
  clinicianNotes: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean(), createdAt: iso })),
  labResults: z.array(z.object({ id: z.string(), date: dateKey, test: z.string(), value: z.number().finite(), unit: z.string(), note: z.string().optional() })),
});

export type ParseBackupResult = { ok: true; data: BackupFile } | { ok: false; error: string };

/** Validates an untrusted backup. Never throws; returns a friendly Indonesian error. */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File bukan JSON yang valid.' };
  }
  if (!raw || typeof raw !== 'object' || (raw as { app?: unknown }).app !== 'jejak-sehat') {
    return { ok: false, error: 'File ini bukan backup Jejak Sehat.' };
  }
  const r = backupSchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue?.path?.join('.') || 'file';
    return { ok: false, error: `Data tidak valid di "${where}": ${issue?.message ?? 'format salah'}.` };
  }
  const dates = r.data.days.map((d) => d.date);
  if (new Set(dates).size !== dates.length) return { ok: false, error: 'Backup berisi tanggal ganda.' };
  return { ok: true, data: r.data as BackupFile };
}

/** Parse a numeric text field (accepts Indonesian comma decimals). Empty → undefined. */
export function parseNumberInput(s: string): number | undefined | 'invalid' {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : 'invalid';
}
