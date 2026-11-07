import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Share2, CalendarPlus, Check } from 'lucide-react';
import type { DailyEntry, UserProfile } from '../domain/types';
import { useAllDays } from '../hooks/data';
import { Button, Card, DateField, EmptyState, Note, NumberField, Segmented, TextField, TimeField, useToast, cx } from '../components/ui';
import { db, newId } from '../db/db';
import { addDays, formatMedium, formatMinutes, formatShort, todayKey } from '../lib/date';
import { fmt1 } from '../lib/format';
import { DROWSY_DRIVING, EDU_CARDS, SLEEP_SAFETY_CARD, URGENT_WARNING } from '../copy/health';
import { GERD_SYMPTOMS, GERD_TRIGGERS, RESTEDNESS } from '../domain/defaults';
import { EXERCISES, PLAN_PHASES, PROGRESSION_RULE, currentPhase } from '../domain/exercise';
import { daysSinceStart } from '../domain/derive';
import { summarizeWeek } from '../domain/insights';
import { shareText } from '../lib/platform';
import { addToCalendar } from '../integrations/calendar';
import { go } from '../App';

type Sub = 'tidur' | 'gerd' | 'latihan' | 'lab' | 'dokter' | 'edukasi';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'tidur', label: 'Tidur' },
  { id: 'gerd', label: 'GERD' },
  { id: 'latihan', label: 'Latihan' },
  { id: 'lab', label: 'Lab' },
  { id: 'dokter', label: 'Tanya dokter' },
  { id: 'edukasi', label: 'Edukasi' },
];

export default function Kesehatan({ profile, sub }: { profile: UserProfile; sub?: string }) {
  const days = useAllDays();
  const active: Sub = (SUBS.find((s) => s.id === sub)?.id ?? 'tidur') as Sub;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kesehatan</h1>
      <nav aria-label="Bagian kesehatan" className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {SUBS.map((s) => (
            <a key={s.id} href={`#/kesehatan/${s.id}`} aria-current={active === s.id ? 'page' : undefined} className={cx('flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm', active === s.id ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line bg-card')}>
              {s.label}
            </a>
          ))}
        </div>
      </nav>
      {!days ? (
        <p className="text-muted">Memuat…</p>
      ) : (
        <>
          {active === 'tidur' && <SleepTab days={days} />}
          {active === 'gerd' && <GerdTab days={days} />}
          {active === 'latihan' && <ExerciseTab profile={profile} />}
          {active === 'lab' && <LabTab />}
          {active === 'dokter' && <DoctorTab days={days} profile={profile} />}
          {active === 'edukasi' && <EduTab />}
        </>
      )}
      <UrgentCard />
    </div>
  );
}

function UrgentCard() {
  return (
    <Note tone="urgent" title={URGENT_WARNING.title}>
      <ul className="list-disc space-y-0.5 pl-4">
        {URGENT_WARNING.items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="mt-1 font-medium">{URGENT_WARNING.action}</p>
    </Note>
  );
}

function SleepTab({ days }: { days: DailyEntry[] }) {
  const recent = [...days].filter((d) => d.sleepDurationMinutes || d.morningRestedness || d.sleepinessAfterLunch1to5).reverse().slice(0, 21);
  const breathing = days.filter((d) => (d.breathingObserved ?? []).length > 0);
  return (
    <div className="space-y-4">
      <Note tone="info" title="Tentang tidur">
        {SLEEP_SAFETY_CARD}
        <span className="mt-1 block">{DROWSY_DRIVING}</span>
      </Note>
      {breathing.length > 0 && (
        <Note tone="caution" title="Pengamatan saat tidur tercatat">
          Jeda napas/tersedak/terbangun berulang tercatat pada {breathing.length} malam. Ini alasan baik untuk evaluasi tidur dengan tenaga kesehatan.
        </Note>
      )}
      <Card title="Log tidur & kantuk (21 entri terakhir)">
        {recent.length === 0 ? (
          <EmptyState title="Belum ada catatan tidur" body="Isi jam tidur & bangun di Catat, atau sinkron dari jam." />
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[340px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-1 py-1 font-normal">Tanggal</th>
                  <th className="px-1 py-1 font-normal">Tidur</th>
                  <th className="px-1 py-1 font-normal">Kualitas</th>
                  <th className="px-1 py-1 font-normal">Bangun</th>
                  <th className="px-1 py-1 font-normal">Kantuk siang</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {recent.map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="px-1 py-2">
                      <a className="text-accent" href={`#/catat/${d.date}`}>{formatShort(d.date)}</a>
                    </td>
                    <td className="px-1 py-2">{formatMinutes(d.sleepDurationMinutes)}{d.sleepSource && d.sleepSource !== 'manual' ? ' ⌚' : ''}</td>
                    <td className="px-1 py-2">{d.sleepQuality1to5 ? `${d.sleepQuality1to5}/5` : '–'}</td>
                    <td className="px-1 py-2">{RESTEDNESS.find((r) => r.id === d.morningRestedness)?.label ?? '–'}</td>
                    <td className="px-1 py-2">{d.sleepinessAfterLunch1to5 ? `${d.sleepinessAfterLunch1to5}/5` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">⌚ = dari jam tangan. Tren ada di halaman Progres.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function GerdTab({ days }: { days: DailyEntry[] }) {
  const episodes = days.flatMap((d) => d.gerdEpisodes.map((e) => ({ ...e, date: d.date }))).reverse();
  const trig = useMemo(() => {
    const counts = new Map<string, number>();
    episodes.forEach((e) => e.triggers.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [episodes]);
  const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;
  return (
    <div className="space-y-4">
      <Card title="Riwayat kemungkinan pemicu">
        {trig.length === 0 ? (
          <p className="text-sm text-muted">Belum ada pemicu yang ditandai.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {trig.map(([t, n]) => (
              <li key={t} className="flex justify-between border-b border-line py-1.5">
                <span>{label(GERD_TRIGGERS, t)}</span>
                <span className="tabular text-muted">
                  {n}× {n >= 3 ? '· mungkin berkaitan' : '· belum cukup untuk menyimpulkan'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Satu kejadian tidak cukup untuk memastikan pemicu. Pemicu sangat individual.</p>
      </Card>
      <Card title="Episode terakhir">
        {episodes.length === 0 ? (
          <EmptyState title="Belum ada episode" body="Tambahkan episode di Catat → GERD bila gejala muncul." />
        ) : (
          <ul className="space-y-2">
            {episodes.slice(0, 30).map((e) => (
              <li key={e.id} className="rounded-xl border border-line bg-white p-3 text-sm">
                <a href={`#/catat/${e.date}`} className="font-medium text-accent">
                  {formatShort(e.date)} {e.time ?? ''}
                </a>{' '}
                · {e.severity === 'mild' ? 'Ringan' : e.severity === 'moderate' ? 'Sedang' : 'Berat'}
                {e.duringFast ? ' · saat puasa' : ''}
                <p className="text-xs text-muted">{e.symptoms.map((s) => label(GERD_SYMPTOMS, s)).join(', ') || '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Note tone="info">Bila gejala sering, memburuk, atau mengganggu tidur/aktivitas, konsultasikan dengan dokter.</Note>
    </div>
  );
}

function ExerciseTab({ profile }: { profile: UserProfile }) {
  const toast = useToast();
  const phase = currentPhase(daysSinceStart(profile, todayKey()));
  const [calDate, setCalDate] = useState(addDays(todayKey(), 1));
  const [calTime, setCalTime] = useState<string | undefined>('06:30');
  return (
    <div className="space-y-4">
      {PLAN_PHASES.map((p) => (
        <Card key={p.id} title={<span>{p.title} {p.id === phase.id && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">sekarang</span>}</span>}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {p.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Card>
      ))}
      <Card title="Aturan progresi">
        <p className="text-sm">
          Mulai {PROGRESSION_RULE.startSets}×{PROGRESSION_RULE.startReps}. Tambah repetisi/set sampai {PROGRESSION_RULE.targetSets}×{PROGRESSION_RULE.targetReps} dengan teknik baik. Setelah tercapai di {PROGRESSION_RULE.sessionsToProgress} sesi berturut, naik
          ke variasi berikutnya. Turun variasi kapan saja bila perlu.
        </p>
      </Card>
      {EXERCISES.map((ex) => (
        <details key={ex.id} className="rounded-2xl border border-line bg-card p-4">
          <summary className="min-h-11 cursor-pointer text-[15px] font-semibold">{ex.name}</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
            {ex.ladder.map((l) => (
              <li key={l.name}>
                <b>{l.name}</b> — {l.how}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-caution">{ex.safety}</p>
        </details>
      ))}
      <Card title="Jadwalkan latihan ke kalender">
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Mulai" value={calDate} min={todayKey()} onChange={setCalDate} />
          <TimeField label="Jam" value={calTime} onChange={setCalTime} />
        </div>
        <Button
          full
          className="mt-3"
          onClick={async () => {
            if (!calTime) return;
            const r = await addToCalendar({ title: 'Latihan kekuatan (Jejak Sehat)', date: calDate, time: calTime, durationMin: 30, description: 'Squat, push-up, glute bridge, bird-dog. Hari ringan boleh.', weeklyCount: 12 }).catch(() => 'cancelled' as const);
            toast(r === 'created' ? 'Ditambahkan ke kalender (berulang mingguan 12×)' : r === 'downloaded' ? 'File .ics diunduh — buka untuk menambah ke kalender' : 'Dibatalkan');
          }}
        >
          <CalendarPlus className="h-4 w-4" /> Tambah ke kalender (mingguan)
        </Button>
        <p className="mt-2 text-xs text-muted">Membuka layar kalender HP; bila akun Google ada di HP, otomatis tersinkron ke Google Calendar. Ulangi untuk hari lain (mis. Senin/Rabu/Jumat).</p>
      </Card>
    </div>
  );
}

function LabTab() {
  const labs = useLiveQuery(() => db.labResults.orderBy('date').reverse().toArray(), []) ?? [];
  const toast = useToast();
  const [test, setTest] = useState('Asam urat');
  const [value, setValue] = useState<number | undefined>();
  const [unit, setUnit] = useState('mg/dL');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  return (
    <div className="space-y-4">
      <Card title="Tambah hasil lab">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Pemeriksaan" value={test} onChange={setTest} />
          <DateField label="Tanggal" value={date} max={todayKey()} onChange={setDate} />
          <NumberField label="Nilai" value={value} onChange={setValue} min={0} max={100000} />
          <TextField label="Satuan" value={unit} onChange={setUnit} />
        </div>
        <div className="mt-3">
          <TextField label="Catatan" value={note} onChange={setNote} />
        </div>
        <Button
          full
          variant="primary"
          className="mt-3"
          disabled={!test.trim() || value == null}
          onClick={async () => {
            await db.labResults.put({ id: newId(), date, test: test.trim(), value: value!, unit, note: note || undefined });
            setValue(undefined);
            setNote('');
            toast('Hasil lab disimpan');
          }}
        >
          <Plus className="h-4 w-4" /> Simpan
        </Button>
      </Card>
      <Card title="Riwayat lab">
        {labs.length === 0 ? (
          <p className="text-sm text-muted">Belum ada hasil lab.</p>
        ) : (
          <ul className="space-y-2">
            {labs.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-xl border border-line bg-white p-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">
                    {l.test}: <span className="tabular">{fmt1(l.value)}</span> {l.unit}
                  </p>
                  <p className="text-xs text-muted">
                    {formatMedium(l.date)}
                    {l.note ? ` · ${l.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Hapus ${l.test}`}
                  className="flex h-11 w-11 items-center justify-center text-muted"
                  onClick={async () => {
                    await db.labResults.delete(l.id);
                    toast('Dihapus', () => void db.labResults.put(l));
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Aplikasi tidak menafsirkan hasil lab. Diskusikan dengan dokter.</p>
      </Card>
    </div>
  );
}

function DoctorTab({ days, profile }: { days: DailyEntry[]; profile: UserProfile }) {
  const notes = useLiveQuery(() => db.clinicianNotes.orderBy('createdAt').toArray(), []) ?? [];
  const labs = useLiveQuery(() => db.labResults.orderBy('date').toArray(), []) ?? [];
  const toast = useToast();
  const [text, setText] = useState('');
  const [apptDate, setApptDate] = useState(addDays(todayKey(), 7));
  const [apptTime, setApptTime] = useState<string | undefined>('09:00');

  function summary(): string {
    const today = todayKey();
    const weeks = [0, 1, 2, 3].map((i) => summarizeWeek(days, addDays(today, -6 - 7 * i), profile.proteinMinG));
    const sleep = weeks.filter((w) => w.avgSleepMin).map((w) => w.avgSleepMin!);
    const sleepy = weeks.filter((w) => w.avgSleepinessAfterLunch).map((w) => w.avgSleepinessAfterLunch!);
    const gerd = weeks.reduce((s, w) => s + w.gerdDays, 0);
    const breathing = days.filter((d) => d.date >= addDays(today, -27) && (d.breathingObserved ?? []).length).length;
    const wt = days.filter((d) => d.weightKg);
    const lines = [
      `Ringkasan Jejak Sehat (4 minggu terakhir, s.d. ${formatMedium(today)})`,
      `Profil: ${profile.sexForBmr === 'male' ? 'pria' : 'wanita'}, ${profile.ageYears} th, ${profile.heightCm} cm. Berat awal ${fmt1(profile.startingWeightKg)} kg (${formatMedium(profile.startingWeightDate)})${wt.length ? `, terakhir ${fmt1(wt[wt.length - 1].weightKg)} kg (${formatMedium(wt[wt.length - 1].date)})` : ''}.`,
      profile.baselineNeckCm ? `Lingkar leher: ${profile.baselineNeckCm} cm.` : '',
      sleep.length ? `Rata-rata tidur per minggu: ${sleep.map((s) => formatMinutes(s)).join(' / ')} (minggu terbaru di depan).` : 'Tidur: belum cukup data.',
      sleepy.length ? `Kantuk setelah makan siang (1–5): ${sleepy.map((s) => fmt1(s)).join(' / ')}.` : '',
      `Pengamatan saat tidur (jeda napas/tersedak/terbangun) tercatat: ${breathing} malam.`,
      `Hari dengan gejala GERD: ${gerd} dari 28 hari.`,
      labs.length ? `Lab: ${labs.map((l) => `${l.test} ${fmt1(l.value)} ${l.unit} (${formatMedium(l.date)})`).join('; ')}.` : '',
      `Kondisi awal: ${profile.baselineNotes}`,
      notes.filter((n) => !n.done).length ? `\nPertanyaan saya:\n${notes.filter((n) => !n.done).map((n) => `- ${n.text}`).join('\n')}` : '',
      '\n(Catatan pribadi dari aplikasi; bukan hasil pemeriksaan medis.)',
    ];
    return lines.filter(Boolean).join('\n');
  }

  return (
    <div className="space-y-4">
      <Card title="Pertanyaan untuk dokter">
        <TextField label="Tambah pertanyaan" value={text} onChange={setText} placeholder="mis. Perlukah saya tes tidur (sleep study)?" />
        <Button
          full
          className="mt-3"
          variant="primary"
          disabled={!text.trim()}
          onClick={async () => {
            await db.clinicianNotes.put({ id: newId(), text: text.trim(), done: false, createdAt: new Date().toISOString() });
            setText('');
          }}
        >
          <Plus className="h-4 w-4" /> Simpan
        </Button>
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center gap-2 rounded-xl border border-line bg-white p-2 text-sm">
              <button type="button" aria-label={n.done ? 'Tandai belum' : 'Tandai sudah dibahas'} onClick={() => void db.clinicianNotes.put({ ...n, done: !n.done })} className={cx('flex h-11 w-11 items-center justify-center rounded-lg', n.done ? 'text-accent' : 'text-muted')}>
                <Check className="h-5 w-5" />
              </button>
              <span className={cx('flex-1', n.done && 'text-muted line-through')}>{n.text}</span>
              <button
                type="button"
                aria-label="Hapus pertanyaan"
                className="flex h-11 w-11 items-center justify-center text-muted"
                onClick={async () => {
                  await db.clinicianNotes.delete(n.id);
                  toast('Dihapus', () => void db.clinicianNotes.put(n));
                }}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Ringkasan untuk dokter">
        <p className="mb-3 text-sm text-muted">Teks ringkas (tidur, kantuk, GERD, berat, lab, pertanyaan) untuk dikirim via WhatsApp/email atau ditunjukkan saat kontrol.</p>
        <Button
          full
          onClick={async () => {
            const r = await shareText('Ringkasan Jejak Sehat', summary());
            toast(r === 'copied' ? 'Ringkasan disalin' : r === 'shared' ? 'Dibagikan' : 'Dibatalkan');
          }}
        >
          <Share2 className="h-4 w-4" /> Bagikan ringkasan
        </Button>
      </Card>
      <Card title="Janji kontrol ke kalender">
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Tanggal" value={apptDate} min={todayKey()} onChange={setApptDate} />
          <TimeField label="Jam" value={apptTime} onChange={setApptTime} />
        </div>
        <Button
          full
          className="mt-3"
          onClick={async () => {
            if (!apptTime) return;
            const r = await addToCalendar({ title: 'Kontrol dokter', date: apptDate, time: apptTime, durationMin: 60, description: 'Bawa ringkasan Jejak Sehat & daftar pertanyaan.' }).catch(() => 'cancelled' as const);
            toast(r === 'created' ? 'Ditambahkan ke kalender' : r === 'downloaded' ? 'File .ics diunduh' : 'Dibatalkan');
          }}
        >
          <CalendarPlus className="h-4 w-4" /> Tambah ke kalender
        </Button>
      </Card>
    </div>
  );
}

function EduTab() {
  const [open, setOpen] = useState<string | undefined>(EDU_CARDS[0].id);
  return (
    <div className="space-y-3">
      <Segmented options={EDU_CARDS.map((c) => ({ id: c.id, label: c.title }))} value={open} onChange={setOpen} />
      {EDU_CARDS.filter((c) => c.id === open).map((c) => (
        <Card key={c.id} title={c.title}>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {c.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Card>
      ))}
      <Button variant="ghost" onClick={() => go({ tab: 'pengaturan', sub: 'privasi' })}>
        Tentang privasi & data
      </Button>
    </div>
  );
}
