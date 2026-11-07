// "Hari ini": one human message per moment of the day, plus one next action.
// Inspired by apps that lead with a single, kind sentence instead of a wall of metrics.
import type { DailyEntry, UserProfile } from './types';
import { effectiveNutrition } from './calc';
import { formatMinutes } from '../lib/date';

export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam';
export type NextAction = 'weight' | 'sleep' | 'photo' | 'food' | 'walk' | 'strength' | 'gerd' | 'none';

export interface TodayMessage {
  part: DayPart;
  headline: string;
  body: string;
  action: { kind: NextAction; label: string };
  tone: 'calm' | 'care';
  /** Focus item id this message already covers (hidden from the list to avoid repeating it). */
  covers?: string;
}

export function dayPart(now: Date): DayPart {
  const h = now.getHours();
  if (h < 4) return 'malam';
  if (h < 11) return 'pagi';
  if (h < 15) return 'siang';
  if (h < 18) return 'sore';
  return 'malam';
}

interface Ctx {
  now: Date;
  today: DailyEntry | undefined;
  lastNight: DailyEntry | undefined; // entry holding last night's sleep (today's wake date)
  recent: DailyEntry[]; // last 7 days
  profile: UserProfile;
}

export function todayMessage({ now, today, lastNight, recent, profile }: Ctx): TodayMessage {
  const part = dayPart(now);
  const nut = effectiveNutrition(today);
  const sleepMin = lastNight?.sleepDurationMinutes;
  const severeGerd = recent.some((d) => d.gerdEpisodes.some((e) => e.severity === 'severe'));
  const fastSymptoms = (today?.fastingSymptoms ?? []).length > 0;

  if (fastSymptoms) {
    return {
      part,
      tone: 'care',
      headline: 'Dengarkan tubuhmu dulu.',
      body: 'Ada gejala saat puasa hari ini. Tidak apa-apa berhenti puasa dan makan/minum. Bila berat atau menetap, cari bantuan medis.',
      action: { kind: 'food', label: 'Catat makan' },
    };
  }
  if (severeGerd) {
    return {
      part,
      tone: 'care',
      headline: 'Pelan-pelan minggu ini.',
      body: 'GERD sempat berat beberapa hari terakhir. Porsi lebih kecil dan jeda 2–3 jam sebelum berbaring sering membantu. Bila berulang, bicarakan dengan dokter.',
      action: { kind: 'gerd', label: 'Catat GERD' },
    };
  }

  if (part === 'pagi') {
    if (sleepMin == null) {
      return { part, tone: 'calm', headline: 'Selamat pagi.', body: 'Mulai dari yang ringan: berapa lama tidurmu semalam?', action: { kind: 'sleep', label: 'Catat tidur semalam' } };
    }
    const short = sleepMin < 6 * 60;
    const body = short
      ? `Tidurmu ${formatMinutes(sleepMin)}. Hari ini jalani pelan-pelan — jalan santai setelah makan siang bisa membantu kantuk.`
      : `Tidurmu ${formatMinutes(sleepMin)}. Modal yang baik untuk hari ini.`;
    if (!today?.weightKg) return { part, tone: 'calm', covers: 'weight', headline: short ? 'Pagi yang agak berat?' : 'Pagi yang baik.', body, action: { kind: 'weight', label: 'Timbang pagi' } };
    return { part, tone: 'calm', headline: short ? 'Pagi yang agak berat?' : 'Pagi yang baik.', body, action: { kind: 'photo', label: 'Foto makan pertama' } };
  }

  if (part === 'siang' || part === 'sore') {
    if (!nut) {
      return {
        part,
        tone: 'calm',
        headline: part === 'siang' ? 'Waktunya makan siang.' : 'Sore yang tenang.',
        body: 'Foto makananmu saja — perkiraan kalori dan protein dibantu, kamu tinggal cek.',
        action: { kind: 'photo', label: 'Foto makanan' },
      };
    }
    const remainP = Math.round(profile.proteinMinG - nut.proteinG);
    if (remainP > 15) {
      return {
        part,
        tone: 'calm',
        covers: 'protein',
        headline: `Protein kurang ±${remainP} g.`,
        body: 'Satu porsi telur, tempe, ayam, atau yogurt di makan berikutnya sudah cukup dekat.',
        action: { kind: 'food', label: 'Catat makanan' },
      };
    }
    if ((today?.steps ?? 0) < profile.stepGoal && (today?.walkingMinutes ?? 0) < 10) {
      return { part, tone: 'calm', covers: 'walk', headline: 'Sempatkan jalan 10 menit.', body: 'Setelah makan siang paling pas — membantu kantuk dan langkah harian.', action: { kind: 'walk', label: 'Catat jalan 10 menit' } };
    }
    return { part, tone: 'calm', headline: 'Hari ini berjalan baik.', body: 'Makan dan gerakmu sudah tercatat. Tidak ada yang perlu dikejar.', action: { kind: 'none', label: '' } };
  }

  // malam
  const avgSleep = (() => {
    const v = recent.filter((d) => d.sleepDurationMinutes).map((d) => d.sleepDurationMinutes!);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  })();
  return {
    part,
    tone: 'calm',
    covers: 'sleep',
    headline: 'Saatnya melambat.',
    body:
      avgSleep != null && avgSleep < 390
        ? `Rata-rata tidurmu minggu ini ${formatMinutes(Math.round(avgSleep))}. Coba berbaring pukul ${profile.bedtimeTarget ?? '22:30'} malam ini.`
        : `Target tidur pukul ${profile.bedtimeTarget ?? '22:30'}. Hindari makan besar 2–3 jam sebelum berbaring.`,
    action: nut ? { kind: 'gerd', label: 'Tutup hari: GERD & catatan' } : { kind: 'food', label: 'Catat makan hari ini' },
  };
}
