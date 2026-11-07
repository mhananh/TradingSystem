// Typed, versioned local data model. Bump SCHEMA_VERSION and add a Dexie migration when shapes change.
export const SCHEMA_VERSION = 1;

export type SexForBmr = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';
export type Restedness = 'refreshed' | 'okay' | 'tired' | 'very_tired';
export type GerdSeverity = 'none' | 'mild' | 'moderate' | 'severe';
export type Effort = 'easy' | 'moderate' | 'hard';
export type DataSource = 'manual' | 'healthconnect' | 'screenshot';
export type MealSource = 'manual' | 'library' | 'favorite' | 'ai-photo' | 'ai-label' | 'ai-menu';

export interface UserProfile {
  id: 'me';
  schemaVersion: number;
  displayName?: string;
  sexForBmr: SexForBmr;
  ageYears: number;
  heightCm: number;
  startingWeightKg: number;
  startingWeightDate: string; // YYYY-MM-DD
  goalWeightKg: number;
  secondaryGoalWeightKg?: number;
  targetDate?: string; // YYYY-MM-DD, editable estimate
  checkpointWeightKg?: number;
  checkpointDate?: string;
  activityLevel: ActivityLevel;
  calorieTargetKcal: number;
  calorieFloorKcal: number;
  proteinTargetG: number;
  proteinMinG: number;
  fatTargetG: number;
  carbTargetG: number;
  stepGoal: number;
  sleepTargetHours: number;
  bedtimeTarget?: string; // HH:mm
  fastingEnabled: boolean;
  eatingWindowStart: string; // HH:mm
  eatingWindowEnd: string; // HH:mm
  ramadanEnabled: boolean;
  ramadanStart: string; // YYYY-MM-DD (estimate)
  ramadanEnd: string;
  baselineWaistCm?: number;
  baselineNeckCm?: number;
  baselineNotes: string; // free-text baseline context, editable
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiEstimateMeta {
  provider: 'claude' | 'gemini';
  model: string;
  kcalMin: number;
  kcalMax: number;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
}

export interface MealEntry {
  id: string;
  name: string;
  time?: string; // HH:mm
  portionDescription?: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimate: boolean;
  source: MealSource;
  ai?: AiEstimateMeta;
  hcWritten?: boolean; // already written to Health Connect
}

export interface GerdEpisode {
  id: string;
  time?: string; // HH:mm
  severity: Exclude<GerdSeverity, 'none'>;
  symptoms: string[];
  context: string[];
  triggers: string[];
  duringFast?: boolean; // auto-derived when time falls inside a logged fast
  note?: string;
}

export interface StrengthLog {
  exerciseId: string;
  level: number; // index into progression ladder
  sets: number;
  reps: number;
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD local; primary key
  weightKg?: number;
  weightStandardCondition?: boolean; // morning, after toilet, before eating
  waistCm?: number;
  meals: MealEntry[];
  // Quick totals for days without itemised meals. Ignored when meals exist.
  totalCaloriesKcal?: number;
  totalProteinG?: number;
  totalCarbsG?: number;
  totalFatG?: number;
  nutritionComplete?: boolean; // distinguishes "incomplete log" from "ate little"
  // Fasting: attributed to the date the fast ENDS.
  fastingStartAt?: string; // ISO timestamp
  fastingEndAt?: string;
  fastingSymptoms?: string[];
  ramadanFast?: boolean;
  // Sleep: attributed to the WAKE date.
  sleepStartAt?: string;
  wakeAt?: string;
  sleepDurationMinutes?: number;
  sleepSource?: DataSource;
  sleepQuality1to5?: number;
  awakenings?: number;
  morningRestedness?: Restedness;
  breathingObserved?: string[]; // pauses, choking/gasping, repeated awakenings
  napMinutes?: number;
  sleepinessMorning1to5?: number;
  sleepinessAfterLunch1to5?: number;
  sleepinessAfternoon1to5?: number;
  energy1to5?: number;
  coffeeCups?: number;
  coffeeTime?: string; // HH:mm of first coffee
  gerdAny?: boolean;
  gerdEpisodes: GerdEpisode[];
  steps?: number;
  stepsSource?: DataSource;
  walkingMinutes?: number;
  strengthWorkout?: boolean;
  strengthLogs?: StrengthLog[];
  exerciseMinutes?: number;
  exerciseType?: string;
  effort?: Effort;
  easyDay?: boolean;
  restingHr?: number;
  restingHrSource?: DataSource;
  spo2Min?: number;
  hcSyncedAt?: string;
  hcWrittenWeightKg?: number;
  waterGlasses?: number;
  focusDone?: string[]; // ids of 'Fokus hari ini' items the user ticked
  notes?: string;
  updatedAt: string;
}

export interface FavoriteMeal {
  id: string;
  name: string;
  portionDescription?: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimate: boolean;
  createdAt: string;
}

export interface ClinicianNote {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface LabResult {
  id: string;
  date: string;
  test: string; // e.g. "Asam urat"
  value: number;
  unit: string; // e.g. "mg/dL"
  note?: string;
}

export interface AiUsageRecord {
  id: string;
  at: string;
  feature: 'food-photo' | 'nutrition-label' | 'screenshot' | 'weekly-review' | 'menu';
  provider: 'claude' | 'gemini';
  model: string;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface BackupFile {
  app: 'jejak-sehat';
  schemaVersion: number;
  exportedAt: string;
  profile: UserProfile | null;
  days: DailyEntry[];
  favorites: FavoriteMeal[];
  clinicianNotes: ClinicianNote[];
  labResults: LabResult[];
}
