import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Camera, Watch, Image as ImageIcon, Sparkles, Check, Loader2, Trash2 } from 'lucide-react';
import { MetricIcon, WeekStrip } from '../components/viz';
import { QuickLogBody } from '../components/QuickLog';
import { isLogged } from '../domain/engagement';
import type { DailyEntry, MealEntry, UserProfile } from '../domain/types';
import { useDayDraft, saveProfile } from '../hooks/data';
import { Button, Chips, ConfirmDialog, NumberField, Note, Scale5, Section, Segmented, TextField, TimeField, Toggle, Badge, useToast } from '../components/ui';
import { addDays, formatLong, formatMinutes, timeOf, todayKey } from '../lib/date';
import { fmt0, fmt1 } from '../lib/format';
import { calculateDailyNutritionTotals, calculateFastingDuration, effectiveNutrition, fastFromClockTimes, sleepFromClockTimes } from '../domain/calc';
import { BREATHING_OBSERVED, FASTING_SYMPTOMS, RESTEDNESS } from '../domain/defaults';
import { LIMITS } from '../domain/validation';
import { AddMealButtons, MealList } from '../components/MealEditor';
import { AiFoodSheet } from '../components/AiFoodSheet';
import { GerdEditor } from '../components/GerdEditor';
import { ScreenshotSheet } from '../components/ScreenshotSheet';
import { MenuSheet } from '../components/MenuSheet';
import { db, deleteDay, getDay, newId, saveDay } from '../db/db';
import { isRamadanDay } from '../domain/derive';
import { coffeeBeforeFirstMeal } from '../domain/insights';
import { EXERCISES, exerciseById, suggestLevel } from '../domain/exercise';
import { isAndroid } from '../lib/platform';
import { syncFromHealthConnect, writeToHealthConnect } from '../integrations/healthConnect';
import { go } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';

export default function Catat({ profile, date }: { profile: UserProfile; date: string }) {
  const { draft, update, state, savedAt, exists, flush, reload } = useDayDraft(date);
  const toast = useToast();
  const [aiOpen, setAiOpen] = useState<null | 'photo' | 'label'>(null);
  const [shotOpen, setShotOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const today = todayKey();
  const weekDays = useLiveQuery(() => db.days.toArray(), []) ?? [];
  const loggedSet = new Set(weekDays.filter((x) => isLogged(x)).map((x) => x.date));
  const uricFlag = (useLiveQuery(() => db.labResults.filter((l) => /urat/i.test(l.test) && l.value >= 6.8).count(), []) ?? 0) > 0;

  // Write weight/meal energy to Health Connect when enabled (deduplicated by flags).
  useEffect(() => {
    if (!draft || state !== 'saved' || !isAndroid()) return;
    let alive = true;
    writeToHealthConnect(draft).then((next) => {
      if (alive && next !== draft) update(() => next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!draft) return <p className="text-muted">Memuat…</p>;
  const d = draft;
  const ramadan = isRamadanDay(profile, date);
  const nut = effectiveNutrition(d);
  const fastMin = calculateFastingDuration(d.fastingStartAt, d.fastingEndAt);
  const coffeeBefore = coffeeBeforeFirstMeal(d);

  function setDate(next: string) {
    void flush().then(() => go({ tab: 'catat', date: next }));
  }

  function addMeals(m: MealEntry[]) {
    update((cur) => ({ ...cur, meals: [...cur.meals, ...m] }));
    toast(m.length > 1 ? `${m.length} item ditambahkan` : `"${m[0].name}" ditambahkan`);
  }

  async function copyYesterday() {
    const y = await getDay(addDays(date, -1));
    if (!y.meals.length) return toast('Kemarin tidak ada daftar makanan untuk disalin.');
    addMeals(y.meals.map((m) => ({ ...m, id: newId(), hcWritten: false })));
  }

  async function syncHc() {
    setSyncing(true);
    await flush();
    const r = await syncFromHealthConnect(today, Math.min(14, Math.max(3, Math.round((Date.now() - new Date(date).getTime()) / 86_400_000) + 2)));
    await reload();
    setSyncing(false);
    toast(r.error ? `Gagal sinkron: ${r.error}` : r.changedDays ? `Sinkron: ${r.changedDays} hari diperbarui dari jam` : 'Sinkron selesai — tidak ada data baru.');
  }

  async function doDelete() {
    setConfirmDelete(false);
    const prev = await deleteDay(date);
    await reload();
    toast('Catatan tanggal ini dihapus', prev ? () => void saveDay(prev).then(reload) : undefined);
  }

  const setTimes = (kind: 'sleep' | 'fast', start?: string, end?: string) => {
    if ((start && !end) || (!start && end)) return; // wait until both times are entered
    if (kind === 'sleep') {
      const s = start && end ? sleepFromClockTimes(date, start, end) : null;
      update({ sleepStartAt: s?.sleepStartAt, wakeAt: s?.wakeAt, sleepDurationMinutes: s?.minutes ?? d.sleepDurationMinutes, sleepSource: 'manual' });
    } else {
      const f = start && end ? fastFromClockTimes(date, start, end) : null;
      update({ fastingStartAt: f?.fastingStartAt, fastingEndAt: f?.fastingEndAt, ramadanFast: ramadan || undefined });
    }
  };
  const bed = d.sleepStartAt ? timeOf(d.sleepStartAt) : undefined;
  const wake = d.wakeAt ? timeOf(d.wakeAt) : undefined;
  const fStart = d.fastingStartAt ? timeOf(d.fastingStartAt) : undefined;
  const fEnd = d.fastingEndAt ? timeOf(d.fastingEndAt) : undefined;

  return (
    <div className="space-y-3">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{formatLong(date)}</p>
          <div className="-mr-2 flex">
            <button type="button" aria-label="Minggu sebelumnya" className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-soft" onClick={() => setDate(addDays(date, -7))}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Minggu berikutnya" disabled={date >= today} className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-soft disabled:opacity-30" onClick={() => setDate(addDays(date, 7) > today ? today : addDays(date, 7))}>
              <ChevronRight className="h-5 w-5" />
            </button>
            <label className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-soft">
              <CalendarDays className="h-5 w-5" aria-hidden />
              <input type="date" aria-label="Pilih tanggal" className="absolute inset-0 opacity-0" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          </div>
        </div>
        <h1 className="font-display text-[30px] font-semibold leading-tight">{date === today ? 'Catatan hari ini' : 'Catatan'}</h1>
        <WeekStrip date={date} maxDate={today} logged={(k) => loggedSet.has(k)} onPick={setDate} />
      </header>
      <p className="text-center text-xs text-muted" role="status" aria-live="polite">
        {state === 'saving' ? 'Menyimpan…' : state === 'saved' ? <span className="text-accent"><Check className="inline h-3.5 w-3.5" /> Tersimpan {savedAt}</span> : state === 'error' ? 'Gagal menyimpan — coba lagi' : exists ? 'Catatan tersimpan. Ubah isian untuk memperbarui.' : 'Semua isian opsional. Tersimpan otomatis.'}
      </p>
      {ramadan && <Note tone="info">Mode Ramadan aktif untuk tanggal ini (tanggal perkiraan).</Note>}

      {date === today && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Cepat</h2>
          <QuickLogBody profile={profile} />
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        {date !== today && (
          <Button onClick={() => setAiOpen('photo')}>
            <Camera className="h-4 w-4" /> Foto makanan
          </Button>
        )}
        {isAndroid() && (
          <Button onClick={() => void syncHc()}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Watch className="h-4 w-4" />} Sinkron jam
          </Button>
        )}
        <Button onClick={() => setShotOpen(true)}>
          <ImageIcon className="h-4 w-4" /> Screenshot jam
        </Button>
      </div>
      <h2 className="pt-2 font-display text-xl font-semibold">Detail</h2>

      <Section title="Berat & pinggang" icon={<MetricIcon metric="weight" />} summary={d.weightKg ? `${fmt1(d.weightKg)} kg` : 'Boleh dilewati'} defaultOpen={!d.weightKg && date === today}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Berat" unit="kg" value={d.weightKg} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={(v) => update({ weightKg: v })} />
          <NumberField label="Pinggang" hint="(opsional)" unit="cm" value={d.waistCm} min={LIMITS.waistCm[0]} max={LIMITS.waistCm[1]} onChange={(v) => update({ waistCm: v })} />
        </div>
        <Toggle label="Kondisi standar" hint="Pagi, setelah ke toilet, sebelum makan/minum" checked={!!d.weightStandardCondition} onChange={(v) => update({ weightStandardCondition: v })} />
        <p className="text-xs text-muted">Satu angka harian bisa naik-turun 0,5–1,5 kg karena air & garam. Lihat tren mingguan di Progres.</p>
      </Section>

      <Section
        title="Makan & makro"
        icon={<MetricIcon metric="kcal" />}
        summary={nut ? `${fmt0(nut.caloriesKcal)} kkal · protein ${fmt0(nut.proteinG)} g${d.nutritionComplete ? ' · lengkap' : ''}` : 'Belum dicatat'}
      >
        {d.meals.length > 0 ? (
          <>
            <MealList meals={d.meals} onChange={(meals) => update({ meals })} />
            <TotalsLine t={calculateDailyNutritionTotals(d.meals)} profile={profile} />
          </>
        ) : (
          <div className="space-y-3 rounded-xl bg-soft p-3">
            <p className="text-sm font-medium">Cukup total harian (opsional)</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Kalori" unit="kkal" value={d.totalCaloriesKcal} min={0} max={10000} integer onChange={(v) => update({ totalCaloriesKcal: v })} />
              <NumberField label="Protein" unit="g" value={d.totalProteinG} min={0} max={1000} onChange={(v) => update({ totalProteinG: v })} />
              <NumberField label="Karbohidrat" unit="g" value={d.totalCarbsG} min={0} max={2000} onChange={(v) => update({ totalCarbsG: v })} />
              <NumberField label="Lemak" unit="g" value={d.totalFatG} min={0} max={1000} onChange={(v) => update({ totalFatG: v })} />
            </div>
            <p className="text-xs text-muted">Bila kamu menambah daftar makanan di bawah, total dihitung dari daftar itu.</p>
          </div>
        )}
        <AddMealButtons onAdd={addMeals} onCopyYesterday={() => void copyYesterday()} />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setAiOpen('photo')}>
            <Camera className="h-4 w-4" /> Foto (AI)
          </Button>
          <Button onClick={() => setMenuOpen(true)}>
            <Sparkles className="h-4 w-4" /> Saran menu
          </Button>
        </div>
        <Toggle label="Catatan makan hari ini lengkap" hint="Membedakan 'belum dicatat' dari 'makan sedikit'" checked={!!d.nutritionComplete} onChange={(v) => update({ nutritionComplete: v })} />
      </Section>

      {(profile.fastingEnabled || ramadan || d.fastingStartAt) && (
        <Section title={ramadan ? 'Puasa Ramadan' : 'Puasa (opsional)'} icon={<MetricIcon metric="water" />} summary={fastMin != null ? `${formatMinutes(fastMin)}` : 'Belum dicatat'}>
          <p className="text-xs text-muted">{ramadan ? 'Isi jam sahur selesai dan jam berbuka.' : `Durasi dicatat ke tanggal puasa berakhir. Jendela makanmu: ${profile.eatingWindowStart}–${profile.eatingWindowEnd}.`}</p>
          <div className="grid grid-cols-2 gap-3">
            <ClockPair resetKey={date} labels={[ramadan ? 'Selesai sahur' : 'Mulai puasa (makan terakhir)', ramadan ? 'Berbuka' : 'Selesai (makan pertama)']} start={fStart} end={fEnd} onChange={(a, b) => setTimes('fast', a, b)} />
          </div>
          {!ramadan && !fStart && (
            <Button variant="ghost" onClick={() => setTimes('fast', profile.eatingWindowEnd, profile.eatingWindowStart)}>
              Isi sesuai jadwal ({profile.eatingWindowEnd} → {profile.eatingWindowStart})
            </Button>
          )}
          {fastMin != null && <p className="text-sm">Durasi puasa: <b className="tabular">{formatMinutes(fastMin)}</b></p>}
          <Chips label="Gejala saat puasa?" options={FASTING_SYMPTOMS} value={d.fastingSymptoms} onChange={(v) => update({ fastingSymptoms: v })} />
          {(d.fastingSymptoms?.length ?? 0) > 0 && (
            <Note tone="caution" title="Utamakan kondisimu">
              Bila gejala muncul saat puasa, sebaiknya hentikan puasa dan makan/minum sesuai kondisi. Bila gejala berat atau menetap, cari bantuan medis.
            </Note>
          )}
          {profile.fastingEnabled && !ramadan && (
            <Button
              onClick={async () => {
                await saveProfile({ ...profile, fastingEnabled: false });
                toast('IF dijeda. Kamu memakai jadwal makan biasa.', () => void saveProfile({ ...profile, fastingEnabled: true }));
              }}
            >
              Jeda IF / makan teratur
            </Button>
          )}
        </Section>
      )}

      <Section title="Tidur semalam" icon={<MetricIcon metric="sleep" />} summary={d.sleepDurationMinutes ? `${formatMinutes(d.sleepDurationMinutes)}${d.sleepSource && d.sleepSource !== 'manual' ? ' · dari jam' : ''}` : 'Boleh diisi besok pagi'}>
        <div className="grid grid-cols-2 gap-3">
          <ClockPair resetKey={date} labels={['Tidur jam', 'Bangun jam']} start={bed} end={wake} onChange={(a, b) => setTimes('sleep', a, b)} />
          <NumberField label="Total tidur" unit="mnt" hint="(bisa dikoreksi)" value={d.sleepDurationMinutes} min={0} max={1440} integer onChange={(v) => update({ sleepDurationMinutes: v, sleepSource: 'manual' })} />
          <NumberField label="Terbangun" unit="kali" value={d.awakenings} min={0} max={50} integer onChange={(v) => update({ awakenings: v })} />
        </div>
        {d.sleepDurationMinutes != null && <p className="text-sm text-muted">≈ {formatMinutes(d.sleepDurationMinutes)} (dicatat ke tanggal bangun)</p>}
        <Scale5 label="Kualitas tidur" value={d.sleepQuality1to5} onChange={(v) => update({ sleepQuality1to5: v })} low="Sangat buruk" high="Sangat baik" />
        <Segmented label="Rasa saat bangun" options={RESTEDNESS} value={d.morningRestedness} onChange={(v) => update({ morningRestedness: v })} />
        <Chips label="Ada yang melihat saat kamu tidur? (opsional)" options={BREATHING_OBSERVED} value={d.breathingObserved} onChange={(v) => update({ breathingObserved: v })} />
        {(d.breathingObserved?.length ?? 0) > 0 && <Note tone="caution">Hal ini sebaiknya dibicarakan dengan tenaga kesehatan untuk evaluasi tidur. Aplikasi tidak bisa mendiagnosis.</Note>}
        <NumberField label="Tidur siang" unit="mnt" value={d.napMinutes} min={0} max={600} integer onChange={(v) => update({ napMinutes: v })} />
      </Section>

      <Section title="GERD" icon={<MetricIcon metric="gerd" />} summary={d.gerdEpisodes.length ? `${d.gerdEpisodes.length} episode` : d.gerdAny === false ? 'Tidak ada' : 'Belum diisi'}>
        <GerdEditor day={d} onChange={(p) => update(p)} />
      </Section>

      <Section title="Energi & kantuk" icon={<MetricIcon metric="energy" />} summary={d.sleepinessAfterLunch1to5 ? `Kantuk siang ${d.sleepinessAfterLunch1to5}/5` : 'Belum diisi'}>
        <Scale5 label="Kantuk pagi" value={d.sleepinessMorning1to5} onChange={(v) => update({ sleepinessMorning1to5: v })} low="Segar" high="Sangat mengantuk" />
        <Scale5 label="Kantuk setelah makan siang" value={d.sleepinessAfterLunch1to5} onChange={(v) => update({ sleepinessAfterLunch1to5: v })} low="Segar" high="Sangat mengantuk" />
        <Scale5 label="Kantuk sore" value={d.sleepinessAfternoon1to5} onChange={(v) => update({ sleepinessAfternoon1to5: v })} low="Segar" high="Sangat mengantuk" />
        <Scale5 label="Energi keseluruhan" value={d.energy1to5} onChange={(v) => update({ energy1to5: v })} low="Sangat rendah" high="Sangat baik" />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Kopi" unit="gelas" value={d.coffeeCups} min={0} max={20} onChange={(v) => update({ coffeeCups: v })} />
          <TimeField label="Jam kopi pertama" value={d.coffeeTime} onChange={(v) => update({ coffeeTime: v })} />
        </div>
        {coffeeBefore === true && <Badge tone="caution">Kopi sebelum makan pertama — bisa memicu GERD pada sebagian orang</Badge>}
        {((d.sleepinessAfterLunch1to5 ?? 0) >= 4 || (d.sleepinessMorning1to5 ?? 0) >= 4) && <Note tone="info">Jangan menyetir atau mengoperasikan mesin saat sangat mengantuk.</Note>}
      </Section>

      <Section title="Aktivitas & latihan" icon={<MetricIcon metric="steps" />} summary={[d.steps != null ? `${fmt0(d.steps)} langkah` : null, d.walkingMinutes ? `jalan ${d.walkingMinutes} mnt` : null, d.strengthWorkout ? 'kekuatan ✓' : null].filter(Boolean).join(' · ') || 'Belum diisi'}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Langkah" value={d.steps} min={0} max={100000} integer onChange={(v) => update({ steps: v, stepsSource: 'manual' })} hint={d.stepsSource === 'healthconnect' ? '(dari jam)' : undefined} />
          <NumberField label="Jalan" unit="mnt" value={d.walkingMinutes} min={0} max={1440} integer onChange={(v) => update({ walkingMinutes: v })} />
        </div>
        <Toggle label="Latihan kekuatan hari ini" checked={!!d.strengthWorkout} onChange={(v) => update({ strengthWorkout: v, strengthLogs: v ? d.strengthLogs ?? [] : d.strengthLogs })} />
        {d.strengthWorkout && <StrengthLogger day={d} onChange={(strengthLogs) => update({ strengthLogs })} />}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Olahraga lain" value={d.exerciseType} onChange={(v) => update({ exerciseType: v || undefined })} placeholder="mis. badminton" />
          <NumberField label="Durasi" unit="mnt" value={d.exerciseMinutes} min={0} max={1440} integer onChange={(v) => update({ exerciseMinutes: v })} />
        </div>
        <Segmented label="Rasa usaha" options={[{ id: 'easy', label: 'Ringan' }, { id: 'moderate', label: 'Sedang' }, { id: 'hard', label: 'Berat' }]} value={d.effort} onChange={(v) => update({ effort: v })} />
        <Toggle label="Hari ringan" hint="Jalan santai saja — itu tetap dihitung" checked={!!d.easyDay} onChange={(v) => update({ easyDay: v })} />
        <p className="text-xs text-muted">Nyeri, sakit, pusing, atau sesak yang tidak biasa: lewati latihan hari ini.</p>
      </Section>

      <Section title="Catatan & data jam" icon={<MetricIcon metric="protein" />} summary={d.notes ? d.notes.slice(0, 40) : 'Opsional'}>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Air" unit="gelas" value={d.waterGlasses} min={0} max={40} integer onChange={(v) => update({ waterGlasses: v })} />
          <NumberField label="Nadi istirahat" unit="bpm" value={d.restingHr} min={LIMITS.restingHr[0]} max={LIMITS.restingHr[1]} integer onChange={(v) => update({ restingHr: v, restingHrSource: 'manual' })} />
          <NumberField label="SpO2 terendah" unit="%" value={d.spo2Min} min={LIMITS.spo2[0]} max={LIMITS.spo2[1]} integer onChange={(v) => update({ spo2Min: v })} />
        </div>
        <TextField label="Catatan" multiline value={d.notes} onChange={(v) => update({ notes: v || undefined })} placeholder="mis. lembur, stres, makan di luar" />
      </Section>

      {exists && (
        <Button full variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Hapus catatan tanggal ini
        </Button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus catatan?"
        body={`Semua isian untuk ${formatLong(date)} akan dihapus. Kamu bisa mengurungkan sesaat setelahnya.`}
        confirmLabel="Hapus"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
      />
      <AiFoodSheet open={!!aiOpen} initialMode={aiOpen ?? 'photo'} onClose={() => setAiOpen(null)} profile={profile} onAdd={addMeals} />
      <ScreenshotSheet
        open={shotOpen}
        onClose={() => setShotOpen(false)}
        day={d}
        onApply={(entry, changed) => {
          update(() => entry);
          toast(changed.length ? `Diperbarui: ${changed.join(', ')}` : 'Tidak ada perubahan.');
        }}
      />
      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
        remainingKcal={profile.calorieTargetKcal - (nut?.caloriesKcal ?? 0)}
        remainingProtein={profile.proteinTargetG - (nut?.proteinG ?? 0)}
        defaultGerd={d.gerdEpisodes.length > 0 || !!d.gerdAny}
        defaultUric={uricFlag}
        onAdd={(m) => addMeals([{ ...m, time: undefined }])}
      />
    </div>
  );
}

/** Two clock inputs that keep partial input locally and report only complete (or fully cleared) pairs. */
function ClockPair({ labels, start, end, onChange, resetKey }: { labels: [string, string]; start?: string; end?: string; onChange: (a?: string, b?: string) => void; resetKey: string }) {
  const [a, setA] = useState(start);
  const [b, setB] = useState(end);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setA(start);
    setB(end);
  } else if (start && end && (start !== a || end !== b) && a && b) {
    // external update (e.g. watch sync) while both local values are set
    setA(start);
    setB(end);
  }
  return (
    <>
      <TimeField label={labels[0]} value={a} onChange={(v) => { setA(v); onChange(v, b); }} />
      <TimeField label={labels[1]} value={b} onChange={(v) => { setB(v); onChange(a, v); }} />
    </>
  );
}

function TotalsLine({ t, profile }: { t: { caloriesKcal: number; proteinG: number; carbsG: number; fatG: number }; profile: UserProfile }) {
  return (
    <p className="rounded-xl bg-soft p-3 text-sm tabular">
      Total: <b>{fmt0(t.caloriesKcal)}</b> / {fmt0(profile.calorieTargetKcal)} kkal · P <b>{fmt1(t.proteinG)}</b>/{profile.proteinTargetG} · K {fmt1(t.carbsG)} · L {fmt1(t.fatG)} g
    </p>
  );
}

function StrengthLogger({ day, onChange }: { day: DailyEntry; onChange: (l: NonNullable<DailyEntry['strengthLogs']>) => void }) {
  const logs = day.strengthLogs ?? [];
  const history = useLiveQuery(async () => {
    const prev = await db.days.where('date').below(day.date).reverse().limit(60).toArray();
    return prev.flatMap((p) => (p.strengthLogs ?? []).map((l) => ({ ...l, date: p.date }))).reverse();
  }, [day.date]);
  return (
    <div className="space-y-3">
      {EXERCISES.map((ex) => {
        const cur = logs.find((l) => l.exerciseId === ex.id);
        const hist = (history ?? []).filter((h) => h.exerciseId === ex.id);
        const sug = suggestLevel(hist, ex);
        const level = cur?.level ?? sug.level;
        const setLog = (patch: Partial<{ level: number; sets: number; reps: number }>) => {
          const base = cur ?? { exerciseId: ex.id, level: sug.level, sets: 0, reps: 0 };
          const next = { ...base, ...patch };
          onChange(next.sets || next.reps ? [...logs.filter((l) => l.exerciseId !== ex.id), next] : logs.filter((l) => l.exerciseId !== ex.id));
        };
        return (
          <div key={ex.id} className="space-y-2 rounded-xl border border-line bg-field p-3">
            <p className="font-medium">{ex.name}</p>
            <label className="block text-sm">
              <span className="sr-only">Variasi {ex.name}</span>
              <select className="min-h-11 w-full rounded-xl border border-line bg-field px-2" value={level} onChange={(e) => setLog({ level: Number(e.target.value) })}>
                {ex.ladder.map((l, i) => (
                  <option key={l.name} value={i}>
                    {i + 1}. {l.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">{exerciseById(ex.id)?.ladder[level]?.how}</p>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Set" value={cur?.sets} min={0} max={20} integer onChange={(v) => setLog({ sets: v ?? 0 })} />
              <NumberField label="Repetisi/set" value={cur?.reps} min={0} max={200} integer onChange={(v) => setLog({ reps: v ?? 0 })} />
            </div>
            <p className="text-xs text-accent">{sug.reason}</p>
          </div>
        );
      })}
    </div>
  );
}
