import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { DailyEntry, MealEntry, UserProfile } from '../domain/types';
import { Button, NumberField, Sheet, TimeField, useToast, cx } from './ui';
import { MetricIcon, type Metric } from './viz';
import { getDay, saveDay } from '../db/db';
import { todayKey, timeOf, formatMinutes } from '../lib/date';
import { sleepFromClockTimes } from '../domain/calc';
import { LIMITS } from '../domain/validation';
import { AiFoodSheet } from './AiFoodSheet';
import { AddMealButtons } from './MealEditor';

export type QuickPanel = null | 'weight' | 'sleep' | 'food';

const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Shared save helper: read latest, apply, save, offer undo. */
export function useQuickApply(date: string = todayKey()) {
  const toast = useToast();
  return async (label: string, f: (d: DailyEntry) => DailyEntry) => {
    const before = await getDay(date);
    const next = f(before);
    await saveDay(next);
    toast(label, () => void saveDay(before));
    return next;
  };
}

/**
 * Quick logging body (used inline on Catat and inside a sheet from "Hari ini").
 * Most entries are a single tap and save immediately to today.
 */
export function QuickLogBody({ profile, initialPanel = null, onDone }: { profile: UserProfile; initialPanel?: QuickPanel; onDone?: () => void }) {
  const today = todayKey();
  const apply = useQuickApply(today);
  const [panel, setPanel] = useState<QuickPanel>(initialPanel);
  const [day, setDay] = useState<DailyEntry | null>(null);
  const [ai, setAi] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [weight, setWeight] = useState<number | undefined>();
  const [bed, setBed] = useState<string | undefined>('23:00');
  const [wake, setWake] = useState<string | undefined>('05:30');

  useEffect(() => {
    void getDay(today).then((d) => {
      setDay(d);
      setWeight(d.weightKg);
      if (d.sleepStartAt) setBed(timeOf(d.sleepStartAt));
      if (d.wakeAt) setWake(timeOf(d.wakeAt));
    });
  }, [today]);

  async function act(id: string, label: string, f: (d: DailyEntry) => DailyEntry, close = false) {
    const next = await apply(label, f);
    setDay(next);
    setFlash(id);
    setTimeout(() => setFlash((x) => (x === id ? null : x)), 700);
    if (close) {
      setPanel(null);
      onDone?.();
    }
  }
  const addMeals = (m: MealEntry[]) => void act('food', m.length > 1 ? `${m.length} item makanan dicatat` : `${m[0].name} dicatat`, (d) => ({ ...d, meals: [...d.meals, ...m] }), true);

  const tiles: { id: string; metric: Metric; label: string; sub: string; onClick: () => void }[] = [
    { id: 'weight', metric: 'weight', label: 'Berat', sub: day?.weightKg ? `${String(day.weightKg).replace('.', ',')} kg` : 'Belum ditimbang', onClick: () => setPanel('weight') },
    { id: 'sleep', metric: 'sleep', label: 'Tidur', sub: day?.sleepDurationMinutes ? formatMinutes(day.sleepDurationMinutes) : 'Semalam', onClick: () => setPanel('sleep') },
    { id: 'photo', metric: 'kcal', label: 'Foto makanan', sub: 'Dibantu AI', onClick: () => setAi(true) },
    { id: 'food', metric: 'protein', label: 'Makanan', sub: 'Favorit & contoh', onClick: () => setPanel('food') },
    { id: 'water', metric: 'water', label: 'Air', sub: `${day?.waterGlasses ?? 0} gelas · +1`, onClick: () => void act('water', 'Air +1 gelas', (d) => ({ ...d, waterGlasses: (d.waterGlasses ?? 0) + 1 })) },
    { id: 'walk', metric: 'steps', label: 'Jalan', sub: `${day?.walkingMinutes ?? 0} mnt · +10`, onClick: () => void act('walk', 'Jalan +10 menit', (d) => ({ ...d, walkingMinutes: (d.walkingMinutes ?? 0) + 10 })) },
    {
      id: 'strength',
      metric: 'strength',
      label: 'Latihan',
      sub: day?.strengthWorkout ? 'Sudah hari ini' : 'Tandai selesai',
      onClick: () => void act('strength', day?.strengthWorkout ? 'Latihan dibatalkan' : 'Latihan kekuatan tercatat', (d) => ({ ...d, strengthWorkout: !d.strengthWorkout })),
    },
    {
      id: 'coffee',
      metric: 'energy',
      label: 'Kopi',
      sub: `${day?.coffeeCups ?? 0} gelas · +1`,
      onClick: () => void act('coffee', 'Kopi +1', (d) => ({ ...d, coffeeCups: (d.coffeeCups ?? 0) + 1, coffeeTime: d.coffeeTime ?? nowHHmm() })),
    },
  ];

  if (panel === 'weight')
    return (
      <div className="space-y-4">
        <NumberField label="Berat pagi ini" unit="kg" value={weight} min={LIMITS.weightKg[0]} max={LIMITS.weightKg[1]} onChange={setWeight} />
        <p className="text-sm text-muted">Naik-turun 0,5–1,5 kg per hari itu normal. Yang dilihat adalah trennya.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => (initialPanel ? onDone?.() : setPanel(null))}>Batal</Button>
          <Button variant="primary" disabled={!weight} onClick={() => void act('weight', `Berat ${String(weight).replace('.', ',')} kg tersimpan`, (d) => ({ ...d, weightKg: weight, weightStandardCondition: true }), true)}>
            Simpan
          </Button>
        </div>
      </div>
    );

  if (panel === 'sleep') {
    const s = bed && wake ? sleepFromClockTimes(today, bed, wake) : null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TimeField label="Tidur jam" value={bed} onChange={setBed} />
          <TimeField label="Bangun jam" value={wake} onChange={setWake} />
        </div>
        {s && <p className="font-display text-2xl">{formatMinutes(s.minutes)}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => (initialPanel ? onDone?.() : setPanel(null))}>Batal</Button>
          <Button
            variant="primary"
            disabled={!s}
            onClick={() => s && void act('sleep', 'Tidur tersimpan', (d) => ({ ...d, sleepStartAt: s.sleepStartAt, wakeAt: s.wakeAt, sleepDurationMinutes: s.minutes, sleepSource: 'manual' }), true)}
          >
            Simpan
          </Button>
        </div>
      </div>
    );
  }

  if (panel === 'food')
    return (
      <div className="space-y-3">
        <AddMealButtons onAdd={addMeals} />
        <Button full variant="ghost" onClick={() => (initialPanel ? onDone?.() : setPanel(null))}>
          Batal
        </Button>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <button key={t.id} type="button" onClick={t.onClick} className="relative flex min-h-[64px] items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left transition-transform duration-100 active:scale-[0.98] active:bg-soft">
            <MetricIcon metric={t.metric} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium">{t.label}</span>
              <span className="block truncate text-xs text-muted">{t.sub}</span>
            </span>
            {flash === t.id && (
              <span className="pop absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-on-accent">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Seberapa mengantuk setelah makan siang?</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={day?.sleepinessAfterLunch1to5 === n}
              onClick={() => void act('sleepy', `Kantuk siang ${n}/5`, (d) => ({ ...d, sleepinessAfterLunch1to5: n }))}
              className={cx('min-h-12 rounded-full border text-base font-medium transition-transform duration-100 active:scale-95', day?.sleepinessAfterLunch1to5 === n ? 'border-ink bg-ink text-card' : 'border-line bg-card')}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>segar</span>
          <span>sangat mengantuk</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void act('gerd-no', 'Tidak ada GERD hari ini', (d) => ({ ...d, gerdAny: d.gerdEpisodes.length ? true : false }))}>Tidak ada GERD</Button>
      </div>
      <AiFoodSheet open={ai} onClose={() => setAi(false)} profile={profile} onAdd={addMeals} />
    </div>
  );
}

export function QuickLogSheet({ open, panel, onClose, profile }: { open: boolean; panel: QuickPanel; onClose: () => void; profile: UserProfile }) {
  const title = panel === 'weight' ? 'Berat hari ini' : panel === 'sleep' ? 'Tidur semalam' : panel === 'food' ? 'Tambah makanan' : 'Catat cepat';
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && <QuickLogBody profile={profile} initialPanel={panel} onDone={onClose} />}
    </Sheet>
  );
}
