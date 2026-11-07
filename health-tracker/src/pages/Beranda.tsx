import { useMemo, useState } from 'react';
import { Settings, ChevronRight, Check } from 'lucide-react';
import type { UserProfile } from '../domain/types';
import { useAllDays } from '../hooks/data';
import { useAchievements } from '../hooks/achievements';
import { Button, Note, cx, useToast } from '../components/ui';
import { DayScene } from '../components/DayScene';
import { QuickLogSheet, useQuickApply, type QuickPanel } from '../components/QuickLog';
import { AiFoodSheet } from '../components/AiFoodSheet';
import { WeeklyRecap, buildRecap } from '../components/WeeklyRecap';
import { formatLong, formatMinutes, todayKey, addDays, weekStart } from '../lib/date';
import { fmt0, fmt1, greeting } from '../lib/format';
import { calculateFastingDuration, calculateGoalProgressPercent, effectiveNutrition } from '../domain/calc';
import { currentWeightEstimate, isRamadanDay, weeklyTrend } from '../domain/derive';
import { buildFocus, focusDone, loggedDaysInLast } from '../domain/engagement';
import { todayMessage, type NextAction } from '../domain/today';
import { getDay, saveDay } from '../db/db';
import { go } from '../App';
import { SLEEP_SAFETY_CARD } from '../copy/health';

export default function Beranda({ profile }: { profile: UserProfile }) {
  const days = useAllDays();
  const toast = useToast();
  const apply = useQuickApply();
  const today = todayKey();
  const achievements = useAchievements(days, profile);
  const [panel, setPanel] = useState<QuickPanel | 'closed'>('closed');
  const [photo, setPhoto] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);

  const data = useMemo(() => {
    if (!days) return null;
    const by = new Map(days.map((d) => [d.date, d]));
    const t = by.get(today);
    const recent = days.filter((d) => d.date >= addDays(today, -6) && d.date <= today);
    return {
      t,
      recent,
      trend: weeklyTrend(days, today),
      current: currentWeightEstimate(days, profile),
      msg: todayMessage({ now: new Date(), today: t, lastNight: t, recent, profile }),
      focus: buildFocus({ today, now: new Date(), day: t, days, profile }),
      logged7: loggedDaysInLast(days, today, 7),
      recap: buildRecap(days, profile, today, null),
      breathing: days.some((d) => (d.breathingObserved ?? []).length > 0),
      sleepy: recent.filter((d) => (d.sleepinessAfterLunch1to5 ?? 0) >= 4).length >= 3,
    };
  }, [days, today, profile]);

  if (!data) return <p className="text-muted">Memuat…</p>;
  const { t, msg, trend } = data;
  const focus = data.focus.filter((f) => f.id !== msg.covers);
  const fastMin = calculateFastingDuration(t?.fastingStartAt, t?.fastingEndAt);
  const nut = effectiveNutrition(t);
  const prog = calculateGoalProgressPercent(profile.startingWeightKg, data.current, profile.goalWeightKg);
  const earned = (achievements ?? []).filter((a) => a.earnedAt).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const showRecap = data.recap.loggedDays > 0 && addDays(weekStart(today), -7) >= profile.startingWeightDate;

  function runAction(kind: NextAction) {
    if (kind === 'weight' || kind === 'sleep' || kind === 'food') setPanel(kind);
    else if (kind === 'photo') setPhoto(true);
    else if (kind === 'walk') void apply('Jalan 10 menit tercatat', (d) => ({ ...d, walkingMinutes: (d.walkingMinutes ?? 0) + 10 }));
    else if (kind === 'gerd' || kind === 'strength') go({ tab: 'catat', date: today });
  }

  async function toggleFocus(id: string) {
    const d = await getDay(today);
    const cur = d.focusDone ?? [];
    const on = !cur.includes(id);
    await saveDay({ ...d, focusDone: on ? [...cur, id] : cur.filter((x) => x !== id) });
    if (on) toast('Satu hal selesai');
  }

  const rows: { label: string; color: string; value: string; unit?: string; note: string; href: string; progress?: number }[] = [
    {
      label: 'Makan',
      color: 'var(--color-m-kcal)',
      value: nut ? fmt0(nut.caloriesKcal) : '–',
      unit: 'kkal',
      note: nut ? `dari ${fmt0(profile.calorieTargetKcal)} · ${t?.nutritionComplete ? 'lengkap' : 'belum lengkap'}` : 'belum dicatat',
      href: `#/catat/${today}`,
      progress: nut ? nut.caloriesKcal / profile.calorieTargetKcal : undefined,
    },
    {
      label: 'Protein',
      color: 'var(--color-m-protein)',
      value: nut ? fmt0(nut.proteinG) : '–',
      unit: 'g',
      note: nut ? `cukup di ${profile.proteinMinG} g · target ${profile.proteinTargetG} g` : 'belum dicatat',
      href: `#/catat/${today}`,
      progress: nut ? nut.proteinG / profile.proteinMinG : undefined,
    },
    {
      label: 'Tidur semalam',
      color: 'var(--color-m-sleep)',
      value: t?.sleepDurationMinutes ? formatMinutes(t.sleepDurationMinutes) : '–',
      note: t?.sleepDurationMinutes ? (t.sleepQuality1to5 ? `kualitas ${t.sleepQuality1to5}/5` : `target ${profile.sleepTargetHours} jam`) : 'belum dicatat',
      href: '#/kesehatan/tidur',
    },
    {
      label: 'Kantuk siang',
      color: 'var(--color-m-energy)',
      value: t?.sleepinessAfterLunch1to5 ? `${t.sleepinessAfterLunch1to5}` : '–',
      unit: t?.sleepinessAfterLunch1to5 ? 'dari 5' : undefined,
      note: 'makin kecil makin segar',
      href: '#/progres',
    },
    {
      label: 'Gerak',
      color: 'var(--color-m-steps)',
      value: t?.steps != null ? fmt0(t.steps) : t?.walkingMinutes ? `${t.walkingMinutes}` : '–',
      unit: t?.steps != null ? 'langkah' : t?.walkingMinutes ? 'mnt jalan' : undefined,
      note: [t?.walkingMinutes && t?.steps != null ? `jalan ${t.walkingMinutes} mnt` : null, t?.strengthWorkout ? 'latihan kekuatan ✓' : null].filter(Boolean).join(' · ') || `target ${fmt0(profile.stepGoal)} langkah`,
      href: `#/catat/${today}`,
    },
  ];

  return (
    <div className="space-y-7">
      <header className="flex items-center justify-between">
        <p className="text-sm text-muted">{formatLong(today)}</p>
        <a href="#/pengaturan" aria-label="Pengaturan" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-soft">
          <Settings className="h-5 w-5" />
        </a>
      </header>

      {/* One message, one action */}
      <section className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
        <DayScene part={msg.part} className="block h-32 w-full" />
        <div className="space-y-3 px-5 pb-5 pt-4">
          <p className="text-sm text-muted">
            {greeting()}
            {profile.displayName ? `, ${profile.displayName}` : ''}
          </p>
          <h1 className="font-display text-[30px] font-semibold leading-[1.1]">{msg.headline}</h1>
          <p className="text-[16px] leading-relaxed text-muted">{msg.body}</p>
          {msg.action.kind !== 'none' && (
            <Button variant="primary" onClick={() => runAction(msg.action.kind)}>
              {msg.action.label}
            </Button>
          )}
        </div>
      </section>

      {/* Three small things */}
      {focus.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">Hal kecil hari ini</h2>
          <ul className="mt-2 divide-y divide-line">
            {focus.map((f) => {
              const done = focusDone(f, t);
              return (
                <li key={f.id}>
                  <button type="button" aria-pressed={done} disabled={f.autoDone} onClick={() => void toggleFocus(f.id)} className="flex w-full items-start gap-3 py-3.5 text-left">
                    <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px]', done ? 'pop border-accent bg-accent text-on-accent' : 'border-muted/60')}>
                      {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span>
                      <span className={cx('block text-[16px]', done && 'text-muted line-through decoration-1')}>{f.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">{f.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Numbers, quietly */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Angka hari ini</h2>
          <a href={`#/catat/${today}`} className="text-sm font-medium text-accent">
            Catat
          </a>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.label}>
              <a href={r.href} className="flex items-center gap-3 py-3.5 active:bg-soft">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-muted">{r.label}</span>
                  <span className="block text-xs text-muted/80">{r.note}</span>
                  {r.progress != null && (
                    <span className="mt-1.5 block h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-soft">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, r.progress * 100)}%`, background: r.color }} />
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className="font-display text-[24px] font-semibold tabular">{r.value}</span>
                  {r.unit && <span className="ml-1 text-xs text-muted"> {r.unit}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">
          {isRamadanDay(profile, today)
            ? `Ramadan · ${fastMin != null ? `puasa ${formatMinutes(fastMin)}` : 'catat sahur & berbuka di Catat'}`
            : profile.fastingEnabled
              ? `Puasa intermiten (uji coba) · makan ${profile.eatingWindowStart}–${profile.eatingWindowEnd}${fastMin != null ? ` · tercatat ${formatMinutes(fastMin)}` : ''}`
              : 'IF tidak aktif · jadwal makan biasa'}
        </p>
      </section>

      {/* Weight, as a trend */}
      <a href="#/progres" className="block rounded-[20px] bg-card p-5 ring-1 ring-line active:bg-soft">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted">Berat · rata-rata 7 hari</p>
          <ChevronRight className="h-4 w-4 text-muted" />
        </div>
        <p className="mt-1 font-display text-[44px] font-semibold leading-none tabular">
          {trend.thisAvg != null ? fmt1(trend.thisAvg) : fmt1(data.current)}{' '}
          <span className="ml-0.5 font-sans text-base font-normal text-muted">kg</span>
        </p>
        <p className="mt-2 text-[15px]">
          {trend.delta == null
            ? 'Timbang 2–3× seminggu untuk melihat arah.'
            : trend.dir === 'down'
              ? `Turun ${fmt1(Math.abs(trend.delta))} kg dari minggu lalu.`
              : trend.dir === 'up'
                ? `Naik ${fmt1(trend.delta)} kg dari minggu lalu — fluktuasi seperti ini wajar.`
                : 'Stabil dibanding minggu lalu.'}
        </p>
        {prog && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-m-weight" style={{ width: `${Math.max(2, prog.percent)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {prog.percent}% menuju {fmt0(profile.goalWeightKg)} kg
            </p>
          </div>
        )}
      </a>

      {/* This week */}
      <section className="rounded-[20px] bg-soft p-5">
        <h2 className="font-display text-xl font-semibold">Minggu ini</h2>
        <p className="mt-1 text-[15px] text-muted">
          {data.logged7} dari 7 hari tercatat
          {earned.length > 0 && ` · ${earned.length} pencapaian`}
          {earned[0] && `, terbaru “${earned[0].a.title}”`}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {showRecap && <Button onClick={() => setRecapOpen(true)}>Rekap minggu lalu</Button>}
          <Button variant="ghost" onClick={() => go({ tab: 'kesehatan', sub: 'pencapaian' })}>
            Pencapaian
          </Button>
        </div>
      </section>

      {data.breathing && <Note tone="caution" title="Pengamatan saat tidur tercatat">Jeda napas atau tersedak saat tidur adalah alasan baik untuk evaluasi tidur dengan tenaga kesehatan.</Note>}
      {!data.breathing && data.sleepy && <Note tone="info" title="Sering mengantuk minggu ini">{SLEEP_SAFETY_CARD}</Note>}

      <QuickLogSheet open={panel !== 'closed'} panel={panel === 'closed' ? null : panel} onClose={() => setPanel('closed')} profile={profile} />
      <AiFoodSheet
        open={photo}
        onClose={() => setPhoto(false)}
        profile={profile}
        onAdd={(m) => void apply(`${m.length} item makanan dicatat`, (d) => ({ ...d, meals: [...d.meals, ...m] }))}
      />
      {recapOpen && <WeeklyRecap data={buildRecap(days!, profile, today, achievements)} onClose={() => setRecapOpen(false)} />}
    </div>
  );
}
