import { useEffect, useMemo, useState } from 'react';
import { X, Share2, ChevronRight } from 'lucide-react';
import type { DailyEntry, UserProfile } from '../domain/types';
import { summarizeWeek, type WeekSummary } from '../domain/insights';
import { calculateRollingAverage } from '../domain/calc';
import { weightPoints } from '../domain/derive';
import { addDays, daysBetween, formatMinutes, formatShort, weekStart } from '../lib/date';
import { fmt0, fmt1 } from '../lib/format';
import { isLogged, type AchievementState } from '../domain/engagement';
import { Sparkline, MetricIcon, type Metric } from './viz';
import { shareText } from '../lib/platform';
import { cx, useToast } from './ui';

export interface RecapData {
  start: string;
  end: string;
  cur: WeekSummary;
  prev: WeekSummary;
  weights: (number | null)[];
  sleeps: (number | null)[];
  loggedDays: number;
  newAchievements: AchievementState[];
  weekNumber: number;
  focus: string;
}

export function buildRecap(days: DailyEntry[], profile: UserProfile, today: string, achievements: AchievementState[] | null): RecapData {
  const start = addDays(weekStart(today), -7); // last completed week
  const end = addDays(start, 6);
  const cur = summarizeWeek(days, start, profile.proteinMinG);
  const prev = summarizeWeek(days, addDays(start, -7), profile.proteinMinG);
  const by = new Map(days.map((d) => [d.date, d]));
  const range = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const weekNumber = Math.max(1, Math.floor(daysBetween(profile.startingWeightDate, start) / 7) + 1);
  let focus = 'Lanjutkan kebiasaan yang sudah berjalan.';
  if (cur.avgSleepMin != null && cur.avgSleepMin < 390) focus = `Tidur lebih awal 30 menit (rata-rata minggu lalu ${formatMinutes(cur.avgSleepMin)}).`;
  else if (cur.completeNutritionDays && cur.proteinMetDays / cur.completeNutritionDays < 0.6) focus = `Protein ≥${profile.proteinMinG} g di lebih banyak hari — tambah 1 sumber protein per makan.`;
  else if (cur.strengthSessions < 2) focus = 'Dua sesi latihan kekuatan singkat (15 menit).';
  else if (cur.walkingMin < 100) focus = 'Jalan 10–15 menit setelah makan siang di hari kerja.';
  return {
    start,
    end,
    cur,
    prev,
    weights: (() => {
      const roll = new Map(calculateRollingAverage(weightPoints(days)).map((x) => [x.date, x.average ?? x.value]));
      return range.map((d) => roll.get(d) ?? null);
    })(),
    sleeps: range.map((d) => (by.get(d)?.sleepDurationMinutes ? by.get(d)!.sleepDurationMinutes! / 60 : null)),
    loggedDays: range.filter((d) => isLogged(by.get(d))).length,
    newAchievements: (achievements ?? []).filter((a) => a.earnedAt && a.earnedAt >= start && a.earnedAt <= addDays(end, 1)),
    weekNumber,
    focus,
  };
}

function recapText(r: RecapData): string {
  return [
    `Rekap Jejak Sehat · Minggu ke-${r.weekNumber} (${formatShort(r.start)}–${formatShort(r.end)})`,
    `Hari tercatat: ${r.loggedDays}/7`,
    r.cur.avgWeight != null ? `Berat rata-rata: ${fmt1(r.cur.avgWeight)} kg${r.prev.avgWeight != null ? ` (${r.cur.avgWeight - r.prev.avgWeight >= 0 ? '+' : ''}${fmt1(r.cur.avgWeight - r.prev.avgWeight)} kg)` : ''}` : '',
    r.cur.avgSleepMin != null ? `Tidur rata-rata: ${formatMinutes(r.cur.avgSleepMin)}` : '',
    r.cur.avgSleepinessAfterLunch != null ? `Kantuk siang: ${fmt1(r.cur.avgSleepinessAfterLunch)}/5` : '',
    `Protein cukup: ${r.cur.proteinMetDays}/${r.cur.completeNutritionDays} hari lengkap`,
    `Jalan: ${r.cur.walkingMin} mnt · Latihan kekuatan: ${r.cur.strengthSessions}×`,
    `Fokus minggu ini: ${r.focus}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function Big({ metric, label, value, unit, sub }: { metric: Metric; label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <MetricIcon metric={metric} size="lg" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-display text-4xl font-semibold tabular">
          {value}
          {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
        </p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/** Full-screen story-style weekly recap. Tap right half → next, left half → back. */
export function WeeklyRecap({ data, onClose }: { data: RecapData; onClose: () => void }) {
  const toast = useToast();
  const [i, setI] = useState(0);
  const r = data;
  const dW = r.cur.avgWeight != null && r.prev.avgWeight != null ? r.cur.avgWeight - r.prev.avgWeight : null;
  const slides = useMemo(
    () => [
      {
        bg: 'bg-[#e8efe6]',
        body: (
          <div className="space-y-4">
            <p className="text-sm font-medium text-accent">Rekap mingguan</p>
            <h2 className="font-display text-5xl font-semibold leading-tight">Minggu ke-{r.weekNumber}</h2>
            <p className="text-muted">{formatShort(r.start)} – {formatShort(r.end)}</p>
            <div className="flex gap-1.5 pt-4">
              {Array.from({ length: 7 }, (_, k) => (
                <span key={k} className={cx('h-10 flex-1 rounded-xl', k < r.loggedDays ? 'bg-accent' : 'bg-ink/10')} />
              ))}
            </div>
            <p className="text-lg">
              Kamu mencatat <b>{r.loggedDays} dari 7 hari</b>.{' '}
              {r.loggedDays >= 5 ? 'Konsisten sekali!' : r.loggedDays >= 3 ? 'Fondasi yang bagus.' : 'Setiap catatan tetap berharga.'}
            </p>
          </div>
        ),
      },
      {
        bg: 'bg-[#e4ece3]',
        body: (
          <div className="space-y-5">
            <Big metric="weight" label="Berat rata-rata" value={r.cur.avgWeight != null ? fmt1(r.cur.avgWeight) : '–'} unit="kg" sub={dW != null ? `${dW <= 0 ? '−' : '+'}${fmt1(Math.abs(dW))} kg dari minggu sebelumnya` : 'Belum cukup timbangan untuk dibandingkan'} />
            <Sparkline values={r.weights} color="var(--color-m-weight)" width={300} height={90} />
            <p className="text-sm text-muted">Garis = rata-rata 7 hari pada hari kamu menimbang. Tren mingguan lebih bermakna dari angka harian.</p>
          </div>
        ),
      },
      {
        bg: 'bg-[#e3e8f1]',
        body: (
          <div className="space-y-5">
            <Big metric="sleep" label="Tidur rata-rata" value={r.cur.avgSleepMin != null ? formatMinutes(r.cur.avgSleepMin) : '–'} sub={r.prev.avgSleepMin != null && r.cur.avgSleepMin != null ? `${r.cur.avgSleepMin - r.prev.avgSleepMin >= 0 ? '+' : '−'}${Math.abs(Math.round(r.cur.avgSleepMin - r.prev.avgSleepMin))} mnt vs minggu sebelumnya` : undefined} />
            <Sparkline values={r.sleeps} color="var(--color-m-sleep)" width={300} height={90} />
            <Big metric="energy" label="Kantuk setelah makan siang" value={r.cur.avgSleepinessAfterLunch != null ? fmt1(r.cur.avgSleepinessAfterLunch) : '–'} unit="/5" sub={r.prev.avgSleepinessAfterLunch != null ? `minggu sebelumnya ${fmt1(r.prev.avgSleepinessAfterLunch)}/5` : undefined} />
          </div>
        ),
      },
      {
        bg: 'bg-[#f5e3d6]',
        body: (
          <div className="space-y-5">
            <Big metric="kcal" label="Kalori rata-rata (hari lengkap)" value={r.cur.avgKcal != null ? fmt0(r.cur.avgKcal) : '–'} unit="kkal" />
            <Big metric="protein" label="Hari protein cukup" value={`${r.cur.proteinMetDays}`} unit={`/ ${r.cur.completeNutritionDays} hari lengkap`} />
            <Big metric="gerd" label="Hari dengan GERD" value={`${r.cur.gerdDays}`} unit={`/ ${r.cur.gerdLoggedDays} hari tercatat`} />
          </div>
        ),
      },
      {
        bg: 'bg-[#e2ede8]',
        body: (
          <div className="space-y-5">
            <Big metric="steps" label="Menit jalan" value={fmt0(r.cur.walkingMin)} unit="mnt" sub={r.cur.avgSteps != null ? `±${fmt0(r.cur.avgSteps)} langkah/hari` : undefined} />
            <Big metric="strength" label="Sesi latihan kekuatan" value={`${r.cur.strengthSessions}×`} />
            {r.newAchievements.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-accent">Pencapaian baru</p>
                {r.newAchievements.map((a) => (
                  <p key={a.a.id} className="rounded-xl bg-card px-3 py-2 text-sm">{a.a.title}</p>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        bg: 'bg-[#e8efe6]',
        body: (
          <div className="space-y-5">
            <p className="text-sm font-medium text-accent">Fokus minggu ini</p>
            <p className="font-display text-3xl font-semibold leading-snug">{r.focus}</p>
            <p className="text-sm text-muted">Satu hal kecil saja. Tidak ada target yang "gagal" — hanya langkah berikutnya.</p>
            <button
              type="button"
              className="relative z-10 flex min-h-12 items-center gap-2 rounded-2xl bg-ink/10 px-4 font-medium"
              onClick={async (e) => {
                e.stopPropagation();
                const res = await shareText('Rekap Jejak Sehat', recapText(r));
                toast(res === 'copied' ? 'Rekap disalin' : res === 'shared' ? 'Dibagikan' : 'Dibatalkan');
              }}
            >
              <Share2 className="h-5 w-5" /> Bagikan rekap
            </button>
          </div>
        ),
      },
    ],
    [r, dW, toast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, slides.length]);

  const s = slides[i];
  return (
    <div role="dialog" aria-modal="true" aria-label="Rekap mingguan" className={cx('fixed inset-0 z-[70] flex flex-col text-ink', s.bg)}>
      <div className="pt-safe px-4 pt-3">
        <div className="flex gap-1">
          {slides.map((_, k) => (
            <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/15">
              <span className={cx('block h-full rounded-full bg-ink transition-all duration-300', k <= i ? 'w-full' : 'w-0')} />
            </span>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" aria-label="Tutup rekap" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div
        className="relative flex flex-1 items-center px-6 pb-16"
        onClick={(e) => {
          const x = e.clientX / window.innerWidth;
          setI((k) => (x < 0.33 ? Math.max(0, k - 1) : Math.min(slides.length - 1, k + 1)));
        }}
      >
        <div key={i} className="rise w-full max-w-md">{s.body}</div>
      </div>
      {i < slides.length - 1 && (
        <div className="pb-safe flex items-center justify-center gap-1 pb-6 text-xs text-muted">
          Ketuk untuk lanjut <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
