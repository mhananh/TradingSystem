import { SCHEMA_VERSION, type DailyEntry, type UserProfile } from './types';

// Baseline from the project brief (7 Nov 2026). Every value is editable in onboarding/settings.
export const BASELINE_DATE = '2026-11-07';

// Eid al-Fitr 2027 / Ramadan 1448 H dates are ASTRONOMICAL ESTIMATES; the official Indonesian
// date is set by government decision (sidang isbat). The user must be able to edit them.
export const ESTIMATED_EID_2027 = '2027-03-10';
export const ESTIMATED_RAMADAN_2027_START = '2027-02-08';
export const ESTIMATED_RAMADAN_2027_END = '2027-03-09';

export function createDefaultProfile(nowIso: string = new Date().toISOString()): UserProfile {
  return {
    id: 'me',
    schemaVersion: SCHEMA_VERSION,
    sexForBmr: 'male',
    ageYears: 26,
    heightCm: 172,
    startingWeightKg: 90,
    startingWeightDate: BASELINE_DATE,
    goalWeightKg: 75,
    secondaryGoalWeightKg: 70,
    targetDate: ESTIMATED_EID_2027,
    checkpointWeightKg: 80,
    checkpointDate: ESTIMATED_RAMADAN_2027_START,
    activityLevel: 'sedentary',
    calorieTargetKcal: 1700,
    calorieFloorKcal: 1500,
    proteinTargetG: 130,
    proteinMinG: 110,
    fatTargetG: 55,
    carbTargetG: 171,
    stepGoal: 5000,
    sleepTargetHours: 7,
    bedtimeTarget: '22:30',
    fastingEnabled: true,
    eatingWindowStart: '09:30',
    eatingWindowEnd: '19:30',
    ramadanEnabled: false,
    ramadanStart: ESTIMATED_RAMADAN_2027_START,
    ramadanEnd: ESTIMATED_RAMADAN_2027_END,
    baselineNotes:
      'Kerja kantor, sebagian besar duduk. Belum rutin olahraga. Tidur biasanya 5–6 jam, mendengkur ringan, bangun tidak segar, mengantuk sepanjang hari (terutama setelah makan siang). GERD kadang-kadang. Kopi kadang di pagi hari. Tidak ada obat rutin.',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function createEmptyDay(date: string, nowIso: string = new Date().toISOString()): DailyEntry {
  return { date, meals: [], gerdEpisodes: [], updatedAt: nowIso };
}

export const GERD_SYMPTOMS = [
  { id: 'heartburn', label: 'Rasa panas di dada/ulu hati' },
  { id: 'regurgitation', label: 'Asam/pahit naik ke mulut' },
  { id: 'nausea', label: 'Mual' },
  { id: 'upper_abdominal', label: 'Tidak nyaman di perut atas' },
  { id: 'other', label: 'Lainnya' },
] as const;

export const GERD_CONTEXT = [
  { id: 'before_meal', label: 'Sebelum makan' },
  { id: 'after_meal', label: 'Setelah makan' },
  { id: 'during_fast', label: 'Saat puasa' },
  { id: 'night', label: 'Malam/saat berbaring' },
  { id: 'unknown', label: 'Tidak tahu' },
] as const;

export const GERD_TRIGGERS = [
  { id: 'coffee', label: 'Kopi' },
  { id: 'spicy', label: 'Pedas' },
  { id: 'fried_fatty', label: 'Gorengan/berlemak' },
  { id: 'chocolate', label: 'Cokelat' },
  { id: 'acidic', label: 'Asam' },
  { id: 'large_meal', label: 'Porsi besar' },
  { id: 'late_meal', label: 'Makan larut' },
  { id: 'lying_down', label: 'Berbaring setelah makan' },
  { id: 'stress', label: 'Stres' },
  { id: 'other', label: 'Lainnya' },
  { id: 'unknown', label: 'Tidak tahu' },
] as const;

export const FASTING_SYMPTOMS = [
  { id: 'reflux_worse', label: 'Refluks memburuk' },
  { id: 'dizzy', label: 'Pusing' },
  { id: 'faint', label: 'Hampir pingsan' },
  { id: 'weak', label: 'Lemas tidak biasa' },
  { id: 'distress', label: 'Sangat tidak nyaman' },
] as const;

export const BREATHING_OBSERVED = [
  { id: 'pauses', label: 'Jeda napas saat tidur' },
  { id: 'gasping', label: 'Tersedak/terengah saat tidur' },
  { id: 'awakenings', label: 'Sering terbangun' },
] as const;

export const RESTEDNESS = [
  { id: 'refreshed', label: 'Segar' },
  { id: 'okay', label: 'Biasa' },
  { id: 'tired', label: 'Lelah' },
  { id: 'very_tired', label: 'Sangat lelah' },
] as const;
