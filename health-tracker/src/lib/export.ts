import type { BackupFile, DailyEntry } from '../domain/types';
import { calculateFastingDuration, effectiveNutrition } from '../domain/calc';

const BOM = '﻿';

function cell(v: unknown, sep: string): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', sep === ';' ? ',' : '.') : String(v);
  if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(header: string[], rows: unknown[][], sep: string): string {
  return BOM + [header, ...rows].map((r) => r.map((c) => cell(c, sep)).join(sep)).join('\r\n') + '\r\n';
}

/**
 * Daily log CSV. `sep = ';'` uses decimal commas (Excel with Indonesian locale); `','` uses decimal points.
 * Empty cells mean "not logged" — never zero.
 */
export function dailyCsv(days: DailyEntry[], sep: ';' | ',' = ';'): string {
  const header = [
    'tanggal', 'berat_kg', 'pinggang_cm', 'kkal', 'protein_g', 'karbo_g', 'lemak_g', 'catatan_makan_lengkap',
    'durasi_puasa_menit', 'tidur_menit', 'kualitas_tidur_1_5', 'rasa_bangun', 'kantuk_pagi', 'kantuk_setelah_makan_siang', 'kantuk_sore',
    'energi_1_5', 'kopi_gelas', 'jam_kopi', 'gerd_ada', 'jumlah_episode_gerd', 'langkah', 'jalan_menit', 'latihan_kekuatan',
    'nadi_istirahat', 'spo2_terendah', 'catatan',
  ];
  const rows = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const n = effectiveNutrition(d);
      return [
        d.date, d.weightKg, d.waistCm, n?.caloriesKcal, n?.proteinG, n?.carbsG, n?.fatG,
        d.nutritionComplete == null ? '' : d.nutritionComplete ? 'ya' : 'tidak',
        calculateFastingDuration(d.fastingStartAt, d.fastingEndAt), d.sleepDurationMinutes, d.sleepQuality1to5, d.morningRestedness,
        d.sleepinessMorning1to5, d.sleepinessAfterLunch1to5, d.sleepinessAfternoon1to5, d.energy1to5, d.coffeeCups, d.coffeeTime,
        d.gerdAny == null && d.gerdEpisodes.length === 0 ? '' : d.gerdAny || d.gerdEpisodes.length > 0 ? 'ya' : 'tidak',
        d.gerdEpisodes.length || '', d.steps, d.walkingMinutes,
        d.strengthWorkout == null ? '' : d.strengthWorkout ? 'ya' : 'tidak', d.restingHr, d.spo2Min, d.notes,
      ];
    });
  return toCsv(header, rows, sep);
}

export function mealsCsv(days: DailyEntry[], sep: ';' | ',' = ';'): string {
  const header = ['tanggal', 'jam', 'nama', 'porsi', 'kkal', 'protein_g', 'karbo_g', 'lemak_g', 'perkiraan', 'sumber'];
  const rows = days.flatMap((d) =>
    d.meals.map((m) => [d.date, m.time, m.name, m.portionDescription, m.caloriesKcal, m.proteinG, m.carbsG, m.fatG, m.estimate ? 'ya' : 'tidak', m.source]),
  );
  return toCsv(header, rows, sep);
}

export function gerdCsv(days: DailyEntry[], sep: ';' | ',' = ';'): string {
  const header = ['tanggal', 'jam', 'keparahan', 'gejala', 'konteks', 'kemungkinan_pemicu', 'saat_puasa', 'catatan'];
  const rows = days.flatMap((d) =>
    d.gerdEpisodes.map((e) => [d.date, e.time, e.severity, e.symptoms.join('|'), e.context.join('|'), e.triggers.join('|'), e.duringFast ? 'ya' : 'tidak', e.note]),
  );
  return toCsv(header, rows, sep);
}

export function backupJson(b: BackupFile): string {
  return JSON.stringify(b, null, 2);
}

export function backupFileName(prefix: string, ext: string, now = new Date()): string {
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `jejak-sehat-${prefix}-${stamp}.${ext}`;
}
