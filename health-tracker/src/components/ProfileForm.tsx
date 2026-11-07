import type { ActivityLevel, UserProfile } from '../domain/types';
import { ACTIVITY_MULTIPLIERS, calculateBmi, calculateBmrMifflin, calculateMacroCalories, calculateRequiredWeeklyRate, calculateTdee, classifyPace } from '../domain/calc';
import { planWeeklyLossKg } from '../domain/tdee';
import { ESTIMATE_EXPLAINER } from '../copy/health';
import { DateField, NumberField, Note, Segmented, TextField, TimeField, Toggle } from './ui';
import { fmt0, fmt1, fmt2 } from '../lib/format';
import { formatMedium, todayKey } from '../lib/date';
import { LIMITS } from '../domain/validation';

type Patch = (p: Partial<UserProfile>) => void;

export function BodyFields({ p, set }: { p: UserProfile; set: Patch }) {
  const bmi = calculateBmi(p.startingWeightKg, p.heightCm);
  return (
    <div className="space-y-4">
      <TextField label="Nama panggilan" hint="(opsional, untuk sapaan)" value={p.displayName} onChange={(v) => set({ displayName: v.trim() ? v.slice(0, 40) : undefined })} />
      <Segmented label="Jenis kelamin (untuk rumus BMR)" options={[{ id: 'male', label: 'Pria' }, { id: 'female', label: 'Wanita' }]} value={p.sexForBmr} allowClear={false} onChange={(v) => v && set({ sexForBmr: v })} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Usia" unit="th" value={p.ageYears} min={LIMITS.ageYears[0]} max={LIMITS.ageYears[1]} integer onChange={(v) => v && set({ ageYears: v })} />
        <NumberField label="Tinggi" unit="cm" value={p.heightCm} min={LIMITS.heightCm[0]} max={LIMITS.heightCm[1]} onChange={(v) => v && set({ heightCm: v })} />
        <NumberField label="Berat awal" unit="kg" value={p.startingWeightKg} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={(v) => v && set({ startingWeightKg: v })} />
        <DateField label="Tanggal berat awal" value={p.startingWeightDate} max={todayKey()} onChange={(v) => set({ startingWeightDate: v })} />
        <NumberField label="Lingkar pinggang" hint="(opsional)" unit="cm" value={p.baselineWaistCm} min={LIMITS.waistCm[0]} max={LIMITS.waistCm[1]} onChange={(v) => set({ baselineWaistCm: v })} />
        <NumberField label="Lingkar leher" hint="(opsional)" unit="cm" value={p.baselineNeckCm} min={20} max={80} onChange={(v) => set({ baselineNeckCm: v })} />
      </div>
      {bmi && <p className="text-sm text-muted">BMI awal: <span className="font-medium text-ink">{fmt1(bmi)}</span>. BMI hanya gambaran kasar; lingkar pinggang melengkapinya (batas umum pria Asia &lt; 90 cm).</p>}
    </div>
  );
}

export function GoalFields({ p, set, currentWeight }: { p: UserProfile; set: Patch; currentWeight?: number | null }) {
  const today = todayKey();
  const w = currentWeight ?? p.startingWeightKg;
  const required = calculateRequiredWeeklyRate(w, p.goalWeightKg, p.targetDate, today);
  const pace = classifyPace(required, w);
  const plan = planWeeklyLossKg(p, w);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Target berat" unit="kg" value={p.goalWeightKg} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={(v) => v && set({ goalWeightKg: v })} />
        <NumberField label="Target jangka panjang" hint="(opsional)" unit="kg" value={p.secondaryGoalWeightKg} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={(v) => set({ secondaryGoalWeightKg: v })} />
        <DateField label="Tanggal target" value={p.targetDate} min={today} onChange={(v) => set({ targetDate: v })} />
        <NumberField label="Checkpoint" hint="(opsional)" unit="kg" value={p.checkpointWeightKg} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={(v) => set({ checkpointWeightKg: v })} />
        <DateField label="Tanggal checkpoint" value={p.checkpointDate} min={today} onChange={(v) => set({ checkpointDate: v })} />
      </div>
      <p className="text-xs text-muted">Tanggal bawaan (±10 Mar 2027 untuk Idul Fitri, ±8 Feb 2027 untuk awal Ramadan) adalah <b>perkiraan</b>; tanggal resmi ditetapkan pemerintah. Ubah kapan saja.</p>
      {required != null && (
        <Note tone={pace === 'ambitious' || pace === 'too_fast' ? 'caution' : 'info'} title={`Laju yang dibutuhkan: ±${fmt2(required)} kg/minggu`}>
          {pace === 'too_fast' && 'Lebih cepat dari 1,5% berat badan per minggu — terlalu cepat untuk disarankan. Pertimbangkan memundurkan tanggal. '}
          {pace === 'ambitious' && 'Termasuk ambisius (di ujung atas laju bertahap yang umum disarankan). Jangan memotong kalori lebih jauh untuk mengejarnya. '}
          {plan != null && <>Rencana kalorimu saat ini (rumus) memperkirakan ±{fmt2(plan)} kg/minggu. </>}
          Target adalah tujuan, bukan prediksi.
        </Note>
      )}
    </div>
  );
}

const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string }[] = [
  { id: 'sedentary', label: 'Duduk (1,2)' },
  { id: 'light', label: 'Ringan (1,375)' },
  { id: 'moderate', label: 'Sedang (1,55)' },
  { id: 'high', label: 'Tinggi (1,725)' },
];

export function NutritionFields({ p, set, currentWeight }: { p: UserProfile; set: Patch; currentWeight?: number | null }) {
  const w = currentWeight ?? p.startingWeightKg;
  const bmr = calculateBmrMifflin({ ...p, weightKg: w });
  const tdee = calculateTdee(bmr, ACTIVITY_MULTIPLIERS[p.activityLevel]);
  const macro = calculateMacroCalories({ proteinG: p.proteinTargetG, carbsG: p.carbTargetG, fatG: p.fatTargetG });
  const diff = macro.total - p.calorieTargetKcal;
  const belowFloor = p.calorieTargetKcal < p.calorieFloorKcal;
  return (
    <div className="space-y-4">
      <Segmented label="Tingkat aktivitas (untuk perkiraan TDEE)" options={ACTIVITY_OPTIONS} value={p.activityLevel} allowClear={false} onChange={(v) => v && set({ activityLevel: v })} />
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-soft p-3 text-sm">
        <div>
          <p className="text-muted">BMR (perkiraan)</p>
          <p className="text-lg font-semibold tabular">{fmt0(bmr)} kkal</p>
        </div>
        <div>
          <p className="text-muted">TDEE (perkiraan)</p>
          <p className="text-lg font-semibold tabular">{fmt0(tdee)} kkal</p>
        </div>
        <p className="col-span-2 text-xs text-muted">Dihitung dari berat {fmt1(w)} kg. Target kalori tidak berubah otomatis.</p>
      </div>
      <details className="rounded-xl border border-line bg-field p-3 text-sm">
        <summary className="min-h-11 cursor-pointer font-medium text-accent">Bagaimana ini diperkirakan?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {ESTIMATE_EXPLAINER.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Target kalori" unit="kkal" value={p.calorieTargetKcal} min={800} max={6000} integer onChange={(v) => v && set({ calorieTargetKcal: v })} />
        <NumberField label="Batas aman bawah" unit="kkal" value={p.calorieFloorKcal} min={800} max={4000} integer onChange={(v) => v && set({ calorieFloorKcal: v })} />
        <NumberField label="Protein target" unit="g" value={p.proteinTargetG} min={0} max={400} onChange={(v) => v != null && set({ proteinTargetG: v })} />
        <NumberField label="Protein minimal" unit="g" value={p.proteinMinG} min={0} max={400} onChange={(v) => v != null && set({ proteinMinG: v })} />
        <NumberField label="Lemak" unit="g" value={p.fatTargetG} min={0} max={300} onChange={(v) => v != null && set({ fatTargetG: v })} />
        <NumberField label="Karbohidrat" unit="g" value={p.carbTargetG} min={0} max={800} onChange={(v) => v != null && set({ carbTargetG: v })} />
      </div>
      <p className="text-sm text-muted">
        Makro = {fmt0(macro.protein)} + {fmt0(macro.carbs)} + {fmt0(macro.fat)} = <b className="text-ink">{fmt0(macro.total)} kkal</b>
        {Math.abs(diff) <= 30 ? ' (selisih pembulatan kecil, tidak masalah).' : ` (${diff > 0 ? '+' : ''}${fmt0(diff)} kkal dari target kalori).`}
      </p>
      {belowFloor && (
        <Note tone="caution" title="Di bawah batas aman">
          Target {fmt0(p.calorieTargetKcal)} kkal lebih rendah dari batas aman {fmt0(p.calorieFloorKcal)} kkal. Asupan lebih rendah tidak otomatis lebih baik dan bisa mengorbankan otot, energi, dan
          asam urat. Lakukan hanya dengan pendampingan tenaga kesehatan.
        </Note>
      )}
    </div>
  );
}

export function HabitFields({ p, set }: { p: UserProfile; set: Patch }) {
  return (
    <div className="space-y-4">
      <Toggle label="Puasa intermiten (uji coba)" hint="Opsional. Bisa dijeda kapan saja." checked={p.fastingEnabled} onChange={(v) => set({ fastingEnabled: v })} />
      {p.fastingEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <TimeField label="Jendela makan mulai" value={p.eatingWindowStart} onChange={(v) => v && set({ eatingWindowStart: v })} />
          <TimeField label="Jendela makan selesai" value={p.eatingWindowEnd} onChange={(v) => v && set({ eatingWindowEnd: v })} />
        </div>
      )}
      <Toggle label="Mode Ramadan" hint={`Perkiraan ${formatMedium(p.ramadanStart)} – ${formatMedium(p.ramadanEnd)}`} checked={p.ramadanEnabled} onChange={(v) => set({ ramadanEnabled: v })} />
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Ramadan mulai (perkiraan)" value={p.ramadanStart} onChange={(v) => set({ ramadanStart: v })} />
        <DateField label="Ramadan selesai (perkiraan)" value={p.ramadanEnd} onChange={(v) => set({ ramadanEnd: v })} />
        <NumberField label="Target tidur" unit="jam" value={p.sleepTargetHours} min={4} max={12} onChange={(v) => v && set({ sleepTargetHours: v })} />
        <TimeField label="Jam tidur target" value={p.bedtimeTarget} onChange={(v) => set({ bedtimeTarget: v })} />
        <NumberField label="Target langkah" unit="/hari" value={p.stepGoal} min={0} max={50000} integer hint="(mulai dari kebiasaanmu)" onChange={(v) => v != null && set({ stepGoal: v })} />
      </div>
      <TextField label="Catatan kondisi awal" multiline value={p.baselineNotes} onChange={(v) => set({ baselineNotes: v })} />
    </div>
  );
}
