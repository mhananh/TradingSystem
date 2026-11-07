import { useEffect, useState } from 'react';
import { Plus, Check, Coffee } from 'lucide-react';
import type { DailyEntry, MealEntry, UserProfile } from '../domain/types';
import { Button, NumberField, Sheet, TimeField, useToast, cx } from './ui';
import { MetricIcon, type Metric } from './viz';
import { getDay, saveDay } from '../db/db';
import { todayKey, timeOf } from '../lib/date';
import { sleepFromClockTimes } from '../domain/calc';
import { LIMITS } from '../domain/validation';
import { AiFoodSheet } from './AiFoodSheet';
import { AddMealButtons } from './MealEditor';
import { go } from '../App';

type Panel = null | 'weight' | 'sleep' | 'food';

const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Floating "+" → quick-log sheet: most entries take 1–2 taps and save immediately to today. */
export function QuickLog({ profile }: { profile: UserProfile }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [day, setDay] = useState<DailyEntry | null>(null);
  const [ai, setAi] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [weight, setWeight] = useState<number | undefined>();
  const [bed, setBed] = useState<string | undefined>('23:00');
  const [wake, setWake] = useState<string | undefined>('05:30');
  const today = todayKey();

  useEffect(() => {
    if (open) void getDay(today).then((d) => {
      setDay(d);
      setWeight(d.weightKg);
      if (d.sleepStartAt) setBed(timeOf(d.sleepStartAt));
      if (d.wakeAt) setWake(timeOf(d.wakeAt));
    });
  }, [open, today]);

  async function apply(id: string, label: string, f: (d: DailyEntry) => DailyEntry) {
    const before = await getDay(today);
    const next = f(before);
    await saveDay(next);
    setDay(next);
    setFlash(id);
    setTimeout(() => setFlash((x) => (x === id ? null : x)), 900);
    toast(label, () => void saveDay(before).then(() => setDay(before)));
  }

  const addMeals = (m: MealEntry[]) => void apply('food', m.length > 1 ? `${m.length} item makanan dicatat` : `"${m[0].name}" dicatat`, (d) => ({ ...d, meals: [...d.meals, ...m] }));

  const tiles: { id: string; metric: Metric; label: string; sub: string; onClick: () => void }[] = [
    { id: 'weight', metric: 'weight', label: 'Berat', sub: day?.weightKg ? `${String(day.weightKg).replace('.', ',')} kg` : 'Timbang pagi', onClick: () => setPanel('weight') },
    { id: 'photo', metric: 'kcal', label: 'Foto makanan', sub: 'AI perkirakan', onClick: () => setAi(true) },
    { id: 'food', metric: 'protein', label: 'Makanan', sub: 'Favorit & contoh', onClick: () => setPanel('food') },
    { id: 'sleep', metric: 'sleep', label: 'Tidur', sub: day?.sleepDurationMinutes ? `${Math.floor(day.sleepDurationMinutes / 60)} j ${day.sleepDurationMinutes % 60} m` : 'Jam tidur/bangun', onClick: () => setPanel('sleep') },
    {
      id: 'water',
      metric: 'water',
      label: 'Air +1',
      sub: `${day?.waterGlasses ?? 0} gelas`,
      onClick: () => void apply('water', 'Air +1 gelas', (d) => ({ ...d, waterGlasses: (d.waterGlasses ?? 0) + 1 })),
    },
    {
      id: 'walk',
      metric: 'steps',
      label: 'Jalan +10 mnt',
      sub: `${day?.walkingMinutes ?? 0} mnt hari ini`,
      onClick: () => void apply('walk', 'Jalan +10 menit 👟', (d) => ({ ...d, walkingMinutes: (d.walkingMinutes ?? 0) + 10 })),
    },
    {
      id: 'strength',
      metric: 'strength',
      label: 'Latihan selesai',
      sub: day?.strengthWorkout ? 'Sudah ✓' : 'Kekuatan 15 mnt',
      onClick: () => void apply('strength', day?.strengthWorkout ? 'Latihan dibatalkan' : 'Latihan kekuatan tercatat 💪', (d) => ({ ...d, strengthWorkout: !d.strengthWorkout })),
    },
    {
      id: 'gerd',
      metric: 'gerd',
      label: 'GERD',
      sub: day?.gerdEpisodes.length ? `${day.gerdEpisodes.length} episode` : day?.gerdAny === false ? 'Tidak ada' : 'Ada / tidak?',
      onClick: () => {
        setOpen(false);
        go({ tab: 'catat', date: today });
      },
    },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Catat cepat"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_12px_30px_-6px_var(--color-accent)] active:scale-95"
      >
        <Plus className="h-8 w-8" strokeWidth={2.6} />
      </button>

      <Sheet open={open} onClose={() => { setOpen(false); setPanel(null); }} title="Catat cepat · hari ini">
        {panel === null && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {tiles.map((t) => (
                <button key={t.id} type="button" onClick={t.onClick} className="relative flex min-h-[84px] flex-col justify-between rounded-2xl border border-line bg-card p-3 text-left active:bg-elev">
                  <MetricIcon metric={t.metric} />
                  <span>
                    <span className="block text-[15px] font-semibold">{t.label}</span>
                    <span className="block text-xs text-muted">{t.sub}</span>
                  </span>
                  {flash === t.id && (
                    <span className="pop absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Kantuk setelah makan siang</p>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={day?.sleepinessAfterLunch1to5 === n}
                    onClick={() => void apply('sleepy', `Kantuk siang ${n}/5`, (d) => ({ ...d, sleepinessAfterLunch1to5: n }))}
                    className={cx('min-h-12 rounded-2xl border text-base font-semibold', day?.sleepinessAfterLunch1to5 === n ? 'border-m-energy bg-m-energy text-on-accent' : 'border-line bg-card')}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted"><span>segar</span><span>sangat mengantuk</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void apply('coffee', 'Kopi +1 dicatat', (d) => ({ ...d, coffeeCups: (d.coffeeCups ?? 0) + 1, coffeeTime: d.coffeeTime ?? nowHHmm() }))}>
                <Coffee className="h-4 w-4" /> Kopi +1
              </Button>
              <Button onClick={() => void apply('gerd-no', 'GERD: tidak ada hari ini', (d) => ({ ...d, gerdAny: d.gerdEpisodes.length ? true : false }))}>Tidak ada GERD</Button>
            </div>
            <Button full variant="ghost" onClick={() => { setOpen(false); go({ tab: 'catat', date: today }); }}>
              Buka catatan lengkap
            </Button>
          </>
        )}

        {panel === 'weight' && (
          <div className="space-y-3">
            <NumberField label="Berat pagi ini" unit="kg" value={weight} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={setWeight} />
            <p className="text-xs text-muted">Naik-turun harian 0,5–1,5 kg itu normal (air & garam). Yang penting trennya.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setPanel(null)}>Kembali</Button>
              <Button variant="primary" disabled={!weight} onClick={() => void apply('weight', `Berat ${String(weight).replace('.', ',')} kg tercatat`, (d) => ({ ...d, weightKg: weight, weightStandardCondition: true })).then(() => setPanel(null))}>
                Simpan
              </Button>
            </div>
          </div>
        )}

        {panel === 'sleep' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TimeField label="Tidur jam" value={bed} onChange={setBed} />
              <TimeField label="Bangun jam" value={wake} onChange={setWake} />
            </div>
            {bed && wake && <p className="text-sm text-muted">≈ {(() => { const s = sleepFromClockTimes(today, bed, wake); return s ? `${Math.floor(s.minutes / 60)} j ${s.minutes % 60} mnt` : '–'; })()}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setPanel(null)}>Kembali</Button>
              <Button
                variant="primary"
                disabled={!bed || !wake}
                onClick={() => {
                  const s = sleepFromClockTimes(today, bed!, wake!);
                  if (!s) return;
                  void apply('sleep', 'Tidur tercatat 🌙', (d) => ({ ...d, sleepStartAt: s.sleepStartAt, wakeAt: s.wakeAt, sleepDurationMinutes: s.minutes, sleepSource: 'manual' })).then(() => setPanel(null));
                }}
              >
                Simpan
              </Button>
            </div>
          </div>
        )}

        {panel === 'food' && (
          <div className="space-y-3">
            <AddMealButtons onAdd={(m) => { addMeals(m); setPanel(null); }} />
            <Button full variant="ghost" onClick={() => setPanel(null)}>Kembali</Button>
          </div>
        )}
      </Sheet>
      <AiFoodSheet open={ai} onClose={() => setAi(false)} profile={profile} onAdd={addMeals} />
    </>
  );
}
