import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, Moon, Flame, Footprints, Dumbbell, Utensils, PenLine, Timer, HeartPulse } from 'lucide-react';
import type { UserProfile } from '../domain/types';
import { useAllDays } from '../hooks/data';
import { Badge, Card, Note, Progress, Stat, cx } from '../components/ui';
import { formatLong, formatMinutes, todayKey, addDays, timeOf, weekStart } from '../lib/date';
import { fmt0, fmt1, greeting, signed1 } from '../lib/format';
import { calculateFastingDuration, calculateGoalProgressPercent, calculateWeightChange, effectiveNutrition } from '../domain/calc';
import { currentWeightEstimate, isRamadanDay, latestWeight, weeklyTrend } from '../domain/derive';
import { summarizeWeek } from '../domain/insights';
import { DROWSY_DRIVING, SLEEP_SAFETY_CARD } from '../copy/health';
import { RESTEDNESS } from '../domain/defaults';

export default function Beranda({ profile }: { profile: UserProfile }) {
  const days = useAllDays();
  const today = todayKey();
  const data = useMemo(() => {
    if (!days) return null;
    const byDate = new Map(days.map((d) => [d.date, d]));
    const t = byDate.get(today);
    const yesterday = byDate.get(addDays(today, -1));
    const sleepDay = t?.sleepDurationMinutes ? t : yesterday?.sleepDurationMinutes ? yesterday : undefined;
    const lw = latestWeight(days);
    const trend = weeklyTrend(days, today);
    const ws = weekStart(today);
    const thisWeek = summarizeWeek(days, ws, profile.proteinMinG);
    const lastWeek = summarizeWeek(days, addDays(ws, -7), profile.proteinMinG);
    const recent = days.filter((d) => d.date >= addDays(today, -6));
    const sleepyDays = recent.filter((d) => (d.sleepinessAfterLunch1to5 ?? 0) >= 4 || (d.sleepinessMorning1to5 ?? 0) >= 4).length;
    const gerdDays = recent.filter((d) => d.gerdAny || d.gerdEpisodes.length).length;
    const severeGerd = recent.some((d) => d.gerdEpisodes.some((e) => e.severity === 'severe'));
    const fastSymptoms = recent.some((d) => (d.fastingSymptoms ?? []).length > 0);
    const breathing = days.some((d) => (d.breathingObserved ?? []).length > 0);
    return { t, sleepDay, lw, trend, thisWeek, lastWeek, sleepyDays, gerdDays, severeGerd, fastSymptoms, breathing, current: currentWeightEstimate(days, profile) };
  }, [days, today, profile]);

  if (!data) return <p className="text-muted">Memuat…</p>;
  const { t, sleepDay, lw, trend, thisWeek, lastWeek } = data;
  const nut = effectiveNutrition(t);
  const change = lw ? calculateWeightChange(profile.startingWeightKg, lw.value) : null;
  const prog = calculateGoalProgressPercent(profile.startingWeightKg, data.current, profile.goalWeightKg);
  const progLong = profile.secondaryGoalWeightKg ? calculateGoalProgressPercent(profile.startingWeightKg, data.current, profile.secondaryGoalWeightKg) : null;
  const ramadan = isRamadanDay(profile, today);
  const fastMin = calculateFastingDuration(t?.fastingStartAt, t?.fastingEndAt);
  const TrendIcon = trend.dir === 'down' ? ArrowDownRight : trend.dir === 'up' ? ArrowUpRight : ArrowRight;

  // One compact, context-aware health reminder (priority order).
  let reminder: { tone: 'caution' | 'info'; title: string; body: string } | null = null;
  if (data.severeGerd) reminder = { tone: 'caution', title: 'GERD berat tercatat minggu ini', body: 'Bila gejala sering, memburuk, atau mengganggu, konsultasikan dengan dokter. Lihat tanda bahaya di halaman Kesehatan.' };
  else if (data.fastSymptoms) reminder = { tone: 'caution', title: 'Ada gejala saat puasa', body: 'Gejala lebih penting dari target puasa. Kamu bisa menjeda IF dan makan teratur kapan saja.' };
  else if (data.breathing) reminder = { tone: 'caution', title: 'Jeda napas/tersedak saat tidur dilaporkan', body: 'Ini alasan baik untuk evaluasi tidur dengan tenaga kesehatan.' };
  else if (data.sleepyDays >= 3) reminder = { tone: 'info', title: 'Sering mengantuk minggu ini', body: `${SLEEP_SAFETY_CARD} ${DROWSY_DRIVING}` };
  else if (data.gerdDays >= 3) reminder = { tone: 'info', title: `GERD muncul ${data.gerdDays} hari minggu ini`, body: 'Catat pemicu yang mungkin terlibat; pola baru bisa disimpulkan setelah beberapa kejadian.' };

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">{formatLong(today)}</p>
        <h1 className="text-2xl font-semibold">{greeting()} 👋</h1>
      </header>

      <a href={`#/catat/${today}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-base font-semibold text-white shadow-sm active:bg-[#255a41]">
        <PenLine className="h-5 w-5" aria-hidden /> Catat hari ini
      </a>

      <Card title="Berat badan" action={<a className="text-sm text-accent" href="#/progres">Grafik</a>}>
        {lw ? (
          <div className="grid grid-cols-2 gap-4">
            <Stat label={`Terakhir (${lw.date === today ? 'hari ini' : lw.date})`} value={fmt1(lw.value)} unit="kg" sub={change != null ? `${signed1(change)} kg dari awal` : undefined} />
            <div>
              <p className="text-xs text-muted">Rata-rata 7 hari</p>
              <p className="flex items-center gap-1 text-xl font-semibold tabular">
                {trend.thisAvg != null ? fmt1(trend.thisAvg) : '–'}
                {trend.thisAvg != null && <span className="text-sm font-normal text-muted">kg</span>}
                {trend.dir !== 'unknown' && <TrendIcon className={cx('h-5 w-5', trend.dir === 'down' ? 'text-accent' : 'text-muted')} aria-label={`tren ${trend.dir === 'down' ? 'turun' : trend.dir === 'up' ? 'naik' : 'datar'}`} />}
              </p>
              <p className="text-xs text-muted">{trend.delta != null ? `${signed1(trend.delta)} kg vs minggu lalu` : 'Butuh ≥2 timbangan per minggu'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Belum ada penimbangan. Timbang pagi hari setelah ke toilet untuk angka yang konsisten.</p>
        )}
        {prog && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Menuju {fmt0(profile.goalWeightKg)} kg</span>
              <span className="tabular text-muted">{prog.percent}%</span>
            </div>
            <Progress value={prog.percent} max={100} label={`Progres menuju ${profile.goalWeightKg} kg`} />
            {prog.movedAway && <p className="text-xs text-muted">Tren saat ini sedikit di atas berat awal — fluktuasi itu normal.</p>}
          </div>
        )}
        {progLong && (
          <details className="mt-3 text-sm">
            <summary className="min-h-11 cursor-pointer text-accent">Target jangka panjang</summary>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Menuju {fmt0(profile.secondaryGoalWeightKg)} kg</span>
                <span className="tabular text-muted">{progLong.percent}%</span>
              </div>
              <Progress value={progLong.percent} max={100} label={`Progres menuju ${profile.secondaryGoalWeightKg} kg`} tone="neutral" />
            </div>
          </details>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><Utensils className="h-4 w-4 text-accent" /> Makan hari ini</span>}>
        {nut ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Kalori</span>
                <span className="tabular text-muted">
                  {fmt0(nut.caloriesKcal)} / {fmt0(profile.calorieTargetKcal)} kkal
                </span>
              </div>
              <Progress value={nut.caloriesKcal} max={profile.calorieTargetKcal} label="Kalori hari ini" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Protein</span>
                <span className="tabular text-muted">
                  {fmt0(nut.proteinG)} / {fmt0(profile.proteinTargetG)} g
                </span>
              </div>
              <Progress value={nut.proteinG} max={profile.proteinTargetG} label="Protein hari ini" />
            </div>
            {!t?.nutritionComplete && <p className="text-xs text-muted">Belum ditandai lengkap — angka bisa bertambah.</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">Belum ada catatan makan hari ini. Cukup total kkal & protein, atau foto makananmu.</p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card as="div" className="!p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted"><Moon className="h-3.5 w-3.5" /> Tidur terakhir</p>
          <p className="mt-1 text-lg font-semibold tabular">{formatMinutes(sleepDay?.sleepDurationMinutes)}</p>
          <p className="text-xs text-muted">
            {sleepDay?.sleepQuality1to5 ? `Kualitas ${sleepDay.sleepQuality1to5}/5` : sleepDay ? 'Kualitas belum diisi' : 'Belum dicatat'}
            {sleepDay?.morningRestedness ? ` · ${RESTEDNESS.find((r) => r.id === sleepDay.morningRestedness)?.label}` : ''}
          </p>
        </Card>
        <Card as="div" className="!p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted"><HeartPulse className="h-3.5 w-3.5" /> Kantuk & GERD</p>
          <p className="mt-1 text-lg font-semibold tabular">{t?.sleepinessAfterLunch1to5 ? `${t.sleepinessAfterLunch1to5}/5` : '–'}</p>
          <p className="text-xs text-muted">
            kantuk siang · GERD: {t?.gerdEpisodes.length ? `${t.gerdEpisodes.length} episode` : t?.gerdAny === false ? 'tidak ada' : t?.gerdAny ? 'ada' : 'belum diisi'}
          </p>
        </Card>
        <Card as="div" className="!p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted"><Footprints className="h-3.5 w-3.5" /> Aktivitas</p>
          <p className="mt-1 text-lg font-semibold tabular">{t?.steps != null ? fmt0(t.steps) : '–'}</p>
          <p className="text-xs text-muted">
            langkah{t?.walkingMinutes ? ` · jalan ${t.walkingMinutes} mnt` : ''}
            {t?.stepsSource === 'healthconnect' && ' · dari jam'}
          </p>
        </Card>
        <Card as="div" className="!p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted"><Dumbbell className="h-3.5 w-3.5" /> Latihan kekuatan</p>
          <p className="mt-1 text-lg font-semibold tabular">{thisWeek.strengthSessions}×</p>
          <p className="text-xs text-muted">minggu ini{t?.strengthWorkout ? ' · hari ini ✓' : ''}</p>
        </Card>
      </div>

      {(profile.fastingEnabled || ramadan) && (
        <Card as="div" className="!p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted"><Timer className="h-3.5 w-3.5" /> {ramadan ? 'Puasa Ramadan' : 'Puasa intermiten (uji coba)'}</p>
          <p className="mt-1 text-[15px]">
            {fastMin != null
              ? `Puasa tercatat: ${formatMinutes(fastMin)} (selesai ${timeOf(t!.fastingEndAt!)})`
              : ramadan
                ? 'Catat jam sahur & berbuka di halaman Catat.'
                : `Jendela makan ${profile.eatingWindowStart}–${profile.eatingWindowEnd}. Belum ada puasa tercatat hari ini.`}
          </p>
        </Card>
      )}
      {!profile.fastingEnabled && !ramadan && <p className="px-1 text-xs text-muted">IF tidak aktif · jadwal makan biasa</p>}

      <Card title={<span className="flex items-center gap-2"><Flame className="h-4 w-4 text-accent" /> Minggu ini vs minggu lalu</span>}>
        <table className="w-full text-sm">
          <caption className="sr-only">Ringkasan mingguan</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-normal">Metrik</th>
              <th className="py-1 text-right font-normal">Minggu ini</th>
              <th className="py-1 text-right font-normal">Lalu</th>
            </tr>
          </thead>
          <tbody className="tabular">
            <Row label="Rata-rata berat" a={thisWeek.avgWeight != null ? `${fmt1(thisWeek.avgWeight)} kg` : '–'} b={lastWeek.avgWeight != null ? `${fmt1(lastWeek.avgWeight)} kg` : '–'} />
            <Row label="Kalori (hari lengkap)" a={thisWeek.avgKcal != null ? `${fmt0(thisWeek.avgKcal)}` : '–'} b={lastWeek.avgKcal != null ? `${fmt0(lastWeek.avgKcal)}` : '–'} />
            <Row label="Protein cukup" a={`${thisWeek.proteinMetDays}/${thisWeek.completeNutritionDays} hr`} b={`${lastWeek.proteinMetDays}/${lastWeek.completeNutritionDays} hr`} />
            <Row label="Rata-rata tidur" a={formatMinutes(thisWeek.avgSleepMin)} b={formatMinutes(lastWeek.avgSleepMin)} />
            <Row label="Kantuk siang" a={thisWeek.avgSleepinessAfterLunch != null ? `${fmt1(thisWeek.avgSleepinessAfterLunch)}/5` : '–'} b={lastWeek.avgSleepinessAfterLunch != null ? `${fmt1(lastWeek.avgSleepinessAfterLunch)}/5` : '–'} />
            <Row label="Hari dengan GERD" a={`${thisWeek.gerdDays}/${thisWeek.gerdLoggedDays}`} b={`${lastWeek.gerdDays}/${lastWeek.gerdLoggedDays}`} />
            <Row label="Menit jalan" a={fmt0(thisWeek.walkingMin)} b={fmt0(lastWeek.walkingMin)} />
            <Row label="Sesi kekuatan" a={`${thisWeek.strengthSessions}`} b={`${lastWeek.strengthSessions}`} />
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">"–" berarti belum ada data, bukan nol. Minggu dimulai Senin.</p>
      </Card>

      {reminder && (
        <Note tone={reminder.tone} title={reminder.title}>
          {reminder.body}
        </Note>
      )}
      {!t && <p className="px-1 text-center text-sm text-muted"><Badge>Hari ini belum dicatat</Badge> Tidak harus lengkap — isi yang kamu tahu saja.</p>}
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-2 text-left font-normal">{label}</th>
      <td className="py-2 text-right font-medium">{a}</td>
      <td className="py-2 text-right text-muted">{b}</td>
    </tr>
  );
}
