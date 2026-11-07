import { useMemo, useState } from 'react';
import { ChevronRight, Sparkles, Check, Timer, Trophy, PlayCircle } from 'lucide-react';
import type { UserProfile } from '../domain/types';
import { useAllDays } from '../hooks/data';
import { useAchievements } from '../hooks/achievements';
import { Card, Note, cx, useToast } from '../components/ui';
import { AchievementBadge, ConsistencyCalendar, DeltaChip, MetricIcon, MetricTile, Rings, Sparkline, METRIC } from '../components/viz';
import { WeeklyRecap, buildRecap } from '../components/WeeklyRecap';
import { formatLong, formatMinutes, todayKey, addDays, timeOf, weekStart } from '../lib/date';
import { fmt0, fmt1, greeting } from '../lib/format';
import { calculateFastingDuration, calculateGoalProgressPercent, calculateWeightChange, effectiveNutrition, calculateRollingAverage } from '../domain/calc';
import { currentWeightEstimate, isRamadanDay, latestWeight, weeklyTrend, weightPoints } from '../domain/derive';
import { buildFocus, consistencyGrid, focusDone, loggedDaysInLast } from '../domain/engagement';
import { DROWSY_DRIVING, SLEEP_SAFETY_CARD } from '../copy/health';
import { getDay, saveDay, getMeta, setMeta } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function Beranda({ profile }: { profile: UserProfile }) {
  const days = useAllDays();
  const toast = useToast();
  const today = todayKey();
  const achievements = useAchievements(days, profile);
  const [recapOpen, setRecapOpen] = useState(false);
  const recapSeen = useLiveQuery(() => getMeta<string | null>('recapSeenWeek', null), []);
  const lastWeekStart = addDays(weekStart(today), -7);

  const data = useMemo(() => {
    if (!days) return null;
    const by = new Map(days.map((d) => [d.date, d]));
    const t = by.get(today);
    const sleepDay = t?.sleepDurationMinutes ? t : by.get(addDays(today, -1))?.sleepDurationMinutes ? by.get(addDays(today, -1)) : undefined;
    const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const rolling = new Map(calculateRollingAverage(weightPoints(days)).map((r) => [r.date, r.average ?? r.value]));
    const recent = days.filter((d) => d.date >= addDays(today, -6));
    return {
      t,
      sleepDay,
      lw: latestWeight(days),
      trend: weeklyTrend(days, today),
      current: currentWeightEstimate(days, profile),
      weightSpark: last14.map((d) => rolling.get(d) ?? null),
      sleepSpark: last14.map((d) => (by.get(d)?.sleepDurationMinutes ? by.get(d)!.sleepDurationMinutes! / 60 : null)),
      stepsSpark: last14.map((d) => by.get(d)?.steps ?? null),
      sleepySpark: last14.map((d) => by.get(d)?.sleepinessAfterLunch1to5 ?? null),
      grid: consistencyGrid(days, today, 12),
      logged30: loggedDaysInLast(days, today, 30),
      sleepyDays: recent.filter((d) => (d.sleepinessAfterLunch1to5 ?? 0) >= 4 || (d.sleepinessMorning1to5 ?? 0) >= 4).length,
      severeGerd: recent.some((d) => d.gerdEpisodes.some((e) => e.severity === 'severe')),
      fastSymptoms: recent.some((d) => (d.fastingSymptoms ?? []).length > 0),
      breathing: days.some((d) => (d.breathingObserved ?? []).length > 0),
      focus: buildFocus({ today, now: new Date(), day: t, days, profile }),
      recap: buildRecap(days, profile, today, null),
    };
  }, [days, today, profile]);

  if (!data) return <p className="text-muted">Memuat…</p>;
  const { t, sleepDay, lw, trend } = data;
  const nut = effectiveNutrition(t);
  const change = lw ? calculateWeightChange(profile.startingWeightKg, lw.value) : null;
  const prog = calculateGoalProgressPercent(profile.startingWeightKg, data.current, profile.goalWeightKg);
  const ramadan = isRamadanDay(profile, today);
  const fastMin = calculateFastingDuration(t?.fastingStartAt, t?.fastingEndAt);
  const sleepGoalMin = profile.sleepTargetHours * 60;
  const rings = [
    { metric: 'kcal' as const, value: nut?.caloriesKcal ?? 0, goal: profile.calorieTargetKcal },
    { metric: 'protein' as const, value: nut?.proteinG ?? 0, goal: profile.proteinTargetG },
    { metric: 'steps' as const, value: t?.steps ?? 0, goal: profile.stepGoal },
    { metric: 'sleep' as const, value: sleepDay?.sleepDurationMinutes ?? 0, goal: sleepGoalMin },
  ];
  const doneCount = data.focus.filter((f) => focusDone(f, t)).length;
  const earned = (achievements ?? []).filter((a) => a.earnedAt).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const nextUp = (achievements ?? []).filter((a) => !a.earnedAt).sort((a, b) => b.progress - a.progress)[0];
  const showRecap = data.recap.loggedDays > 0 && lastWeekStart >= profile.startingWeightDate.slice(0, 10);
  const recapNew = showRecap && recapSeen !== lastWeekStart;

  async function toggleFocus(id: string) {
    const d = await getDay(today);
    const cur = d.focusDone ?? [];
    const on = !cur.includes(id);
    await saveDay({ ...d, focusDone: on ? [...cur, id] : cur.filter((x) => x !== id) });
    if (on) toast('Bagus! Satu langkah kecil selesai ✨');
  }

  let reminder: { tone: 'caution' | 'info'; title: string; body: string } | null = null;
  if (data.severeGerd) reminder = { tone: 'caution', title: 'GERD berat tercatat minggu ini', body: 'Bila sering, memburuk, atau mengganggu, konsultasikan dengan dokter. Lihat tanda bahaya di Kesehatan.' };
  else if (data.fastSymptoms) reminder = { tone: 'caution', title: 'Ada gejala saat puasa', body: 'Gejala lebih penting dari target puasa. Kamu bisa menjeda IF kapan saja.' };
  else if (data.breathing) reminder = { tone: 'caution', title: 'Jeda napas/tersedak saat tidur dilaporkan', body: 'Alasan baik untuk evaluasi tidur dengan tenaga kesehatan.' };
  else if (data.sleepyDays >= 3) reminder = { tone: 'info', title: 'Sering mengantuk minggu ini', body: `${SLEEP_SAFETY_CARD} ${DROWSY_DRIVING}` };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">{formatLong(today)}</p>
          <h1 className="text-[26px] font-bold tracking-tight">
            {greeting()}
            {profile.displayName ? `, ${profile.displayName}` : ''}
          </h1>
        </div>
        <a href="#/progres" className="flex items-center gap-1 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted">
          {data.logged30}/30 hari tercatat
        </a>
      </header>

      {/* Hero: today's rings */}
      <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-[#14251f] via-card to-[#161a33] p-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="flex items-center gap-4">
          <Rings
            rings={rings}
            size={136}
            stroke={10}
            center={
              <>
                <span className="text-xl font-bold leading-none tabular">{fmt0(nut?.caloriesKcal ?? 0)}</span>
                <span className="mt-0.5 text-[10px] text-muted">kkal</span>
              </>
            }
          />
          <ul className="grid min-w-0 flex-1 grid-cols-1 gap-2">
            {[
              { m: 'kcal' as const, v: `${fmt0(nut?.caloriesKcal ?? 0)}`, g: `/${fmt0(profile.calorieTargetKcal)} kkal` },
              { m: 'protein' as const, v: `${fmt0(nut?.proteinG ?? 0)}`, g: `/${profile.proteinTargetG} g` },
              { m: 'steps' as const, v: t?.steps != null ? fmt0(t.steps) : '0', g: `/${fmt0(profile.stepGoal)}` },
              { m: 'sleep' as const, v: sleepDay?.sleepDurationMinutes ? formatMinutes(sleepDay.sleepDurationMinutes) : '–', g: `/${profile.sleepTargetHours} j` },
            ].map((r) => (
              <li key={r.m} className="min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: METRIC[r.m].color }} />
                  {METRIC[r.m].label}
                </span>
                <span className="block truncate text-[15px] font-semibold leading-tight tabular">
                  {r.v}
                  <span className="ml-0.5 text-[11px] font-normal text-muted">{r.g}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {!t && <p className="mt-3 text-center text-xs text-muted">Belum ada catatan hari ini — tekan <b className="text-accent">+</b> untuk mulai, cukup 1 ketukan.</p>}
      </section>

      {/* Weekly recap entry */}
      {showRecap && (
        <button
          type="button"
          onClick={() => {
            setRecapOpen(true);
            void setMeta('recapSeenWeek', lastWeekStart);
          }}
          className="rise flex w-full items-center gap-3 rounded-3xl border border-accent/30 bg-gradient-to-r from-accent-soft to-card p-3.5 text-left"
        >
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-on-accent">
            <PlayCircle className="h-6 w-6" />
            {recapNew && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-m-kcal ring-2 ring-card" />}
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Rekap Minggu ke-{data.recap.weekNumber}</span>
            <span className="block text-xs text-muted">{data.recap.loggedDays}/7 hari tercatat · ketuk untuk melihat</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </button>
      )}

      {/* Fokus hari ini */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> Fokus hari ini
          </span>
        }
        action={<span className="rounded-full bg-soft px-2.5 py-1 text-xs font-semibold tabular text-muted">{doneCount}/{data.focus.length}</span>}
      >
        {data.focus.length === 0 ? (
          <p className="text-sm text-muted">Semua beres untuk saat ini. Nikmati harimu 🌿</p>
        ) : (
          <ul className="space-y-2">
            {data.focus.map((f) => {
              const done = focusDone(f, t);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={done}
                    disabled={f.autoDone}
                    onClick={() => void toggleFocus(f.id)}
                    className={cx('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors', done ? 'border-accent/30 bg-accent-soft/50' : 'border-line bg-field active:bg-elev')}
                  >
                    <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2', done ? 'pop border-accent bg-accent text-on-accent' : 'border-line')}>
                      {done && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-[15px] font-medium', done && 'text-muted line-through decoration-accent/60')}>{f.title}</span>
                      <span className="block text-xs text-muted">{f.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Weight hero */}
      <a href="#/progres" className="rise block rounded-3xl border border-line bg-card p-4 active:bg-elev">
        <div className="flex items-center gap-2">
          <MetricIcon metric="weight" size="sm" />
          <span className="text-xs font-medium text-muted">Berat · rata-rata 7 hari</span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted" />
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[40px] font-bold leading-none tracking-tight tabular">
              {trend.thisAvg != null ? fmt1(trend.thisAvg) : lw ? fmt1(lw.value) : '–'}
              <span className="ml-1 text-base font-medium text-muted">kg</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <DeltaChip value={trend.delta} unit="kg/mgg" />
              <DeltaChip value={change} unit="kg dari awal" />
            </div>
          </div>
          <Sparkline values={data.weightSpark} color="var(--color-m-weight)" width={120} height={56} />
        </div>
        {prog && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-muted">
                {fmt1(profile.startingWeightKg)} → <b className="text-ink">{fmt0(profile.goalWeightKg)} kg</b>
                {profile.secondaryGoalWeightKg ? <span className="text-muted"> · lalu {fmt0(profile.secondaryGoalWeightKg)}</span> : null}
              </span>
              <span className="font-semibold tabular text-accent">{prog.percent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-gradient-to-r from-m-steps to-accent" style={{ width: `${Math.max(2, prog.percent)}%` }} />
            </div>
          </div>
        )}
      </a>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          metric="sleep"
          label="Tidur semalam"
          value={sleepDay?.sleepDurationMinutes ? `${Math.floor(sleepDay.sleepDurationMinutes / 60)}j${String(sleepDay.sleepDurationMinutes % 60).padStart(2, '0')}` : '–'}
          spark={data.sleepSpark}
          progress={sleepDay?.sleepDurationMinutes ? sleepDay.sleepDurationMinutes / sleepGoalMin : 0}
          sub={sleepDay?.sleepQuality1to5 ? `Kualitas ${sleepDay.sleepQuality1to5}/5` : 'Target ' + profile.sleepTargetHours + ' jam'}
          href="#/kesehatan/tidur"
        />
        <MetricTile metric="energy" label="Kantuk siang" value={t?.sleepinessAfterLunch1to5 ?? '–'} unit="/5" spark={data.sleepySpark} sub="lebih rendah = lebih segar" href="#/progres" />
        <MetricTile metric="steps" value={t?.steps != null ? fmt0(t.steps) : '–'} spark={data.stepsSpark} progress={(t?.steps ?? 0) / profile.stepGoal} sub={t?.walkingMinutes ? `Jalan ${t.walkingMinutes} mnt` : `Target ${fmt0(profile.stepGoal)}`} />
        <MetricTile
          metric="gerd"
          value={t?.gerdEpisodes.length ? t.gerdEpisodes.length : t?.gerdAny === false ? '0' : '–'}
          unit={t?.gerdEpisodes.length || t?.gerdAny === false ? 'episode' : undefined}
          sub={t?.gerdAny === false ? 'Hari yang tenang' : t?.gerdEpisodes.length ? 'Tercatat hari ini' : 'Belum diisi'}
          href="#/kesehatan/gerd"
        />
      </div>

      {(profile.fastingEnabled || ramadan) && (
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-card p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-info">
            <Timer className="h-4 w-4" />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-medium">{ramadan ? 'Puasa Ramadan' : 'Puasa intermiten · uji coba'}</p>
            <p className="text-xs text-muted">
              {fastMin != null ? `Tercatat ${formatMinutes(fastMin)} (selesai ${timeOf(t!.fastingEndAt!)})` : ramadan ? 'Catat sahur & berbuka di Catat.' : `Jendela makan ${profile.eatingWindowStart}–${profile.eatingWindowEnd}`}
            </p>
          </div>
        </div>
      )}
      {!profile.fastingEnabled && !ramadan && <p className="px-1 text-xs text-muted">IF tidak aktif · jadwal makan biasa</p>}

      {reminder && (
        <Note tone={reminder.tone} title={reminder.title}>
          {reminder.body}
        </Note>
      )}

      {/* Consistency calendar */}
      <Card title="Kalender konsistensi" action={<span className="text-xs text-muted">12 minggu</span>}>
        <ConsistencyCalendar grid={data.grid} />
        <p className="mt-2 text-xs text-muted">Tidak ada "streak" yang putus. Setiap hari tercatat tetap terhitung.</p>
      </Card>

      {/* Achievements */}
      {achievements && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-m-energy" /> Pencapaian
            </span>
          }
          action={<span className="text-xs text-muted">{earned.length}/{achievements.length}</span>}
        >
          <div className="space-y-2">
            {earned.slice(0, 2).map((s) => (
              <AchievementBadge key={s.a.id} s={s} />
            ))}
            {nextUp && <AchievementBadge s={nextUp} />}
          </div>
          <a href="#/kesehatan/pencapaian" className="mt-3 flex min-h-11 items-center justify-center gap-1 text-sm font-medium text-accent">
            Lihat semua <ChevronRight className="h-4 w-4" />
          </a>
        </Card>
      )}

      {recapOpen && <WeeklyRecap data={buildRecap(days!, profile, today, achievements)} onClose={() => setRecapOpen(false)} />}
    </div>
  );
}
