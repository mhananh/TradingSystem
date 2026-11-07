import { useMemo, useState } from 'react';
import { Loader2, Sparkles, Lightbulb } from 'lucide-react';
import type { UserProfile } from '../domain/types';
import { useAllDays } from '../hooks/data';
import { Badge, Button, Card, EmptyState, Note, Segmented, Stat } from '../components/ui';
import { NutritionBars, SimpleLine, SleepChart, WeeklyBars, WeightChart, dayNum } from '../components/Charts';
import { addDays, daysBetween, formatMedium, formatShort, todayKey, weekStart } from '../lib/date';
import { fmt0, fmt1, fmt2, signed1 } from '../lib/format';
import { calculateRequiredWeeklyRate, calculateRollingAverage, calculateWeightChange, classifyPace, effectiveNutrition } from '../domain/calc';
import { calculateObservedTdee, planWeeklyLossKg, projectAllScenarios, OBSERVED_TDEE_RULES } from '../domain/tdee';
import { buildInsights, checkpointAdvice, summarizeWeek, trendInsight } from '../domain/insights';
import { currentWeightEstimate, daysSinceStart, isRamadanDay, latestWeight, weightPoints } from '../domain/derive';
import { weeklyReview } from '../ai/features';
import type { WeeklyReviewResult } from '../ai/schemas';
import { AiError } from '../ai/client';

type Range = '14' | '30' | '90' | 'all';

export default function Progres({ profile }: { profile: UserProfile }) {
  const days = useAllDays();
  const [range, setRange] = useState<Range>('30');
  const [showProj, setShowProj] = useState(true);
  const today = todayKey();
  const [review, setReview] = useState<WeeklyReviewResult | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  const m = useMemo(() => {
    if (!days) return null;
    const start = range === 'all' ? (days[0]?.date ?? today) : addDays(today, -(Number(range) - 1));
    const inRange = days.filter((d) => d.date >= start && d.date <= today);
    const wp = weightPoints(days);
    const rolling = calculateRollingAverage(wp);
    const weightData = rolling.filter((r) => r.date >= start).map((r) => ({ x: dayNum(r.date), weight: r.value, avg: r.average }));
    const current = currentWeightEstimate(days, profile);
    const observed = calculateObservedTdee(days, profile, today);
    const endDate = profile.targetDate && profile.targetDate > today ? profile.targetDate : null;
    const scen = endDate ? projectAllScenarios(profile, current, today, endDate, observed.ok ? observed.tdeeKcal : null) : null;
    const projection = scen
      ? scen[0].points.map((p, i) => ({ x: dayNum(p.date), opt: p.weightKg, mid: scen[1].points[i]?.weightKg, pes: scen[2].points[i]?.weightKg }))
      : undefined;
    const nutData = inRange.map((d) => {
      const n = effectiveNutrition(d);
      return { x: dayNum(d.date), n, complete: !!d.nutritionComplete };
    });
    const kcal = nutData.filter((r) => r.n).map((r) => ({ x: r.x, complete: r.complete ? r.n!.caloriesKcal : undefined, incomplete: r.complete ? undefined : r.n!.caloriesKcal }));
    const prot = nutData.filter((r) => r.n).map((r) => ({ x: r.x, complete: r.complete ? r.n!.proteinG : undefined, incomplete: r.complete ? undefined : r.n!.proteinG }));
    const sleep = inRange
      .filter((d) => d.sleepDurationMinutes || d.sleepinessAfterLunch1to5)
      .map((d) => ({ x: dayNum(d.date), sleepH: d.sleepDurationMinutes ? Math.round((d.sleepDurationMinutes / 60) * 10) / 10 : undefined, sleepiness: d.sleepinessAfterLunch1to5 }));
    const waist = inRange.filter((d) => d.waistCm).map((d) => ({ x: dayNum(d.date), waist: d.waistCm! }));
    const rhr = inRange.filter((d) => d.restingHr).map((d) => ({ x: dayNum(d.date), rhr: d.restingHr! }));
    const weeks: { week: string; gerd: number; logged: number; walk: number; strength: number }[] = [];
    const nWeeks = range === '14' ? 2 : range === '30' ? 5 : range === '90' ? 13 : Math.min(26, Math.ceil((daysBetween(start, today) + 1) / 7));
    for (let i = nWeeks - 1; i >= 0; i--) {
      const ws = addDays(weekStart(today), -7 * i);
      const s = summarizeWeek(days, ws, profile.proteinMinG);
      weeks.push({ week: formatShort(ws), gerd: s.gerdDays, logged: s.gerdLoggedDays, walk: s.walkingMin, strength: s.strengthSessions });
    }
    const trend = trendInsight(days, today, current);
    return { weightData, projection, scen, current, observed, kcal, prot, sleep, waist, rhr, weeks, trend, endDate };
  }, [days, range, today, profile]);

  if (!days || !m) return <p className="text-muted">Memuat…</p>;
  const lw = latestWeight(days);
  const change = lw ? calculateWeightChange(profile.startingWeightKg, lw.value) : null;
  const remaining = Math.round((m.current - profile.goalWeightKg) * 10) / 10;
  const required = calculateRequiredWeeklyRate(m.current, profile.goalWeightKg, profile.targetDate, today);
  const pace = classifyPace(required, m.current);
  const plan = planWeeklyLossKg(profile, m.current, m.observed.ok ? m.observed.tdeeKcal : null);
  const insights = buildInsights(days, profile, today, m.current);
  const cp = checkpointAdvice(days, profile, today, m.trend.kgPerWeek ?? null);

  async function runReview() {
    setReviewBusy(true);
    setReviewErr(null);
    try {
      const ws = weekStart(today);
      setReview(
        await weeklyReview(
          {
            thisWeek: summarizeWeek(days!, ws, profile.proteinMinG),
            lastWeek: summarizeWeek(days!, addDays(ws, -7), profile.proteinMinG),
            insights,
            observedTdee: m!.observed.ok ? m!.observed.tdeeKcal : null,
            daysSinceStart: daysSinceStart(profile, today),
            ifEnabled: profile.fastingEnabled,
            ramadan: isRamadanDay(profile, today),
          },
          profile,
        ),
      );
    } catch (e) {
      setReviewErr(e instanceof AiError ? e.message : 'Gagal membuat review.');
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Progres</h1>
      <Segmented
        options={[
          { id: '14', label: '2 mgg' },
          { id: '30', label: '1 bln' },
          { id: '90', label: '3 bln' },
          { id: 'all', label: 'Semua' },
        ]}
        value={range}
        allowClear={false}
        onChange={(v) => v && setRange(v)}
      />

      <Card title="Berat badan">
        <div className="mb-3 grid grid-cols-3 gap-3">
          <Stat label="Awal" value={fmt1(profile.startingWeightKg)} unit="kg" />
          <Stat label="Terakhir" value={fmt1(lw?.value)} unit="kg" sub={change != null ? `${signed1(change)} kg` : undefined} />
          <Stat label={`Sisa ke ${fmt0(profile.goalWeightKg)}`} value={remaining > 0 ? fmt1(remaining) : '0'} unit="kg" sub="dari tren" />
        </div>
        {m.weightData.length === 0 ? (
          <EmptyState title="Belum ada penimbangan di rentang ini" body="Timbang pagi hari beberapa kali seminggu; garis rata-rata muncul setelah ≥3 timbangan dalam 7 hari." />
        ) : (
          <>
            <WeightChart points={m.weightData} goal={profile.goalWeightKg} projection={showProj ? m.projection : undefined} />
            <p className="mt-2 text-xs text-muted">
              Titik = timbangan harian (naik-turun normal). Garis hijau = rata-rata 7 hari, hanya bila ada ≥3 timbangan dalam 7 hari. Hari tanpa timbangan tidak diisi/ditebak.
            </p>
          </>
        )}
        {m.projection && (
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={showProj} onChange={(e) => setShowProj(e.target.checked)} className="h-5 w-5 accent-[#2f6b4f]" />
            Tampilkan skenario (bukan janji)
          </label>
        )}
      </Card>

      <Card title="Laju menuju target">
        {required != null ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Dibutuhkan" value={fmt2(required)} unit="kg/mgg" sub={`sampai ${formatMedium(profile.targetDate!)}`} />
              <Stat label="Dari rencanamu" value={fmt2(plan)} unit="kg/mgg" sub={m.observed.ok ? 'pakai TDEE terobservasi' : 'pakai rumus (perkiraan)'} />
            </div>
            {(pace === 'ambitious' || pace === 'too_fast') && (
              <Note tone="caution">
                Laju yang dibutuhkan termasuk {pace === 'too_fast' ? 'terlalu cepat' : 'ambisius'}. Pilihan sehat: geser tanggal, atau terima hasil yang sedikit di atas target. Memotong kalori di bawah{' '}
                {fmt0(profile.calorieFloorKcal)} kkal tidak disarankan.
              </Note>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Isi tanggal target di Pengaturan untuk menghitung laju yang dibutuhkan.</p>
        )}
        {m.scen && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Skenario (perkiraan kasar)</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-normal">Skenario</th>
                  {profile.checkpointDate && profile.checkpointDate > today && <th className="py-1 text-right font-normal">{formatShort(profile.checkpointDate)}</th>}
                  <th className="py-1 text-right font-normal">{formatShort(m.endDate!)}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {m.scen.map((s) => (
                  <tr key={s.params.id} className="border-t border-line align-top">
                    <th scope="row" className="py-2 text-left font-normal">
                      {s.params.label}
                      {s.params.id === 'middle' && m.observed.ok && <Badge tone="accent">data kamu</Badge>}
                      <span className="block text-xs text-muted">{s.params.id === 'middle' && m.observed.ok ? 'Memakai TDEE terobservasi dari catatanmu.' : s.params.description}</span>
                    </th>
                    {profile.checkpointDate && profile.checkpointDate > today && <td className="whitespace-nowrap py-2 pl-2 text-right">{fmt1(s.weightAt(profile.checkpointDate))} kg</td>}
                    <td className="whitespace-nowrap py-2 pl-2 text-right font-medium">{fmt1(s.weightAt(m.endDate!))} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              Model energi harian dengan kebutuhan yang turun seiring berat. Tidak memperhitungkan air/glikogen, Ramadan, sakit, atau perubahan kebiasaan. Tanggal selesai tidak pernah pasti.
            </p>
          </div>
        )}
      </Card>

      <Card title="Kebutuhan energi terobservasi">
        {m.observed.ok ? (
          <div className="space-y-2">
            <Stat label="TDEE dari datamu" value={fmt0(m.observed.tdeeKcal)} unit="kkal/hari" sub={`${formatShort(m.observed.windowStart)}–${formatShort(m.observed.windowEnd)} · ${m.observed.completeDays} hari lengkap · ${m.observed.weighIns} timbangan`} />
            <p className="text-sm text-muted">
              Rata-rata tercatat {fmt0(m.observed.avgIntakeKcal)} kkal, tren berat {signed1(m.observed.slopeKgPerWeek)} kg/minggu. Angka ini ikut "menyerap" kebiasaan pencatatanmu, jadi tetap berguna walau catatan tidak sempurna — asal konsisten.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Butuh ≥{OBSERVED_TDEE_RULES.minSpanDays} hari (minggu pertama tidak dihitung), ≥{Math.round(OBSERVED_TDEE_RULES.minCompleteRatio * 100)}% hari dengan catatan makan "lengkap", dan ≥{OBSERVED_TDEE_RULES.minWeighIns} timbangan. Sekarang: {m.observed.completeDays} hari lengkap, {m.observed.weighIns} timbangan.
          </p>
        )}
      </Card>

      {cp.due && (
        <Card title={<span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-accent" /> Checkpoint</span>}>
          <ul className="space-y-1.5 text-sm">
            {cp.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Insight (hanya bila data cukup)">
        <ul className="space-y-3">
          {insights.map((i) => (
            <li key={i.id} className="rounded-xl border border-line bg-white p-3">
              <p className="text-sm font-medium">{i.question}</p>
              <p className="mt-1 text-sm">{i.text}</p>
              {i.status === 'insufficient' && <p className="mt-1 text-xs text-muted">Perlu: {i.needed}</p>}
              {i.detail && <p className="mt-1 text-xs text-muted">{i.detail}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Korelasi bukan sebab-akibat. Banyak faktor bisa berperan bersamaan.</p>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Review mingguan AI</span>}>
        {!review && (
          <>
            <p className="mb-3 text-sm text-muted">Mengirim ringkasan statistik (tanpa catatan bebas/foto) ke penyedia AI untuk narasi & 1–3 saran kecil.</p>
            <Button full disabled={reviewBusy} onClick={() => void runReview()}>
              {reviewBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Buat review minggu ini
            </Button>
          </>
        )}
        {reviewErr && <Note tone="caution">{reviewErr}</Note>}
        {review && (
          <div className="space-y-3 text-sm">
            <p>{review.summary}</p>
            {review.highlights.length > 0 && (
              <div>
                <p className="font-medium">Yang berjalan baik</p>
                <ul className="list-disc pl-5">{review.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            )}
            {review.suggestions.length > 0 && (
              <div>
                <p className="font-medium">Saran minggu depan</p>
                <ol className="list-decimal space-y-1 pl-5">
                  {review.suggestions.map((s) => (
                    <li key={s.title}>
                      <b>{s.title}</b> — {s.detail}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {review.data_gaps.length > 0 && <p className="text-xs text-muted">Data yang kurang: {review.data_gaps.join('; ')}</p>}
            {review.see_clinician && <Note tone="caution">Ada pola yang layak dibicarakan dengan tenaga kesehatan. Simpan pertanyaanmu di Kesehatan → Tanya dokter.</Note>}
            <p className="text-xs text-muted">Dibuat oleh AI — perkiraan & saran umum, bukan nasihat medis.</p>
            <Button variant="ghost" onClick={() => setReview(null)}>Tutup</Button>
          </div>
        )}
      </Card>

      <Card title="Kalori harian">
        {m.kcal.length ? <NutritionBars data={m.kcal} target={profile.calorieTargetKcal} unit="kkal" label="kalori" /> : <EmptyState title="Belum ada catatan makan" body="Hari tanpa catatan dibiarkan kosong, bukan dianggap nol." />}
      </Card>
      <Card title="Protein harian">
        {m.prot.length ? <NutritionBars data={m.prot} target={profile.proteinMinG} unit="g" label="protein" /> : <EmptyState title="Belum ada data protein" body="Isi total protein atau daftar makanan di Catat." />}
      </Card>
      <Card title="Tidur & kantuk siang">
        {m.sleep.length ? <SleepChart data={m.sleep} targetHours={profile.sleepTargetHours} /> : <EmptyState title="Belum ada data tidur" body="Isi tidur di pagi hari, atau sinkronkan dari jam." />}
      </Card>
      <Card title="GERD per minggu">
        <WeeklyBars data={m.weeks} bars={[{ key: 'gerd', name: 'Hari dengan GERD' }, { key: 'logged', name: 'Hari status GERD diisi', color: '#c9c2b6' }]} />
      </Card>
      <Card title="Aktivitas per minggu">
        <WeeklyBars data={m.weeks} bars={[{ key: 'strength', name: 'Sesi kekuatan' }]} height={160} />
        <WeeklyBars data={m.weeks} bars={[{ key: 'walk', name: 'Menit jalan', color: '#2d5b86' }]} height={160} />
      </Card>
      {m.waist.length > 0 && (
        <Card title="Lingkar pinggang">
          <SimpleLine data={m.waist} dataKey="waist" name="Pinggang" unit="cm" />
        </Card>
      )}
      {m.rhr.length > 0 && (
        <Card title="Nadi istirahat">
          <SimpleLine data={m.rhr} dataKey="rhr" name="Nadi istirahat" unit="bpm" color="#2d5b86" />
          <p className="mt-1 text-xs text-muted">Sering turun pelan seiring kebugaran membaik; bisa naik saat kurang tidur atau sakit.</p>
        </Card>
      )}
    </div>
  );
}
