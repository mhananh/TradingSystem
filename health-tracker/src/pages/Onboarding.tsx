import { useState } from 'react';
import { ShieldCheck, Moon } from 'lucide-react';
import type { UserProfile } from '../domain/types';
import { createDefaultProfile, BASELINE_DATE } from '../domain/defaults';
import { BodyFields, GoalFields, HabitFields, NutritionFields } from '../components/ProfileForm';
import { Button, Card, DateField, Note, NumberField, Toggle } from '../components/ui';
import { saveProfile } from '../hooks/data';
import { DROWSY_DRIVING, PRIVACY_TEXT, SLEEP_SAFETY_CARD, URGENT_WARNING } from '../copy/health';
import { db, newId, saveDay } from '../db/db';
import { createEmptyDay } from '../domain/defaults';
import { profileSchema } from '../domain/validation';

const STEPS = ['Selamat datang', 'Tubuh', 'Target', 'Gizi', 'Kebiasaan', 'Kesehatan'];

export default function Onboarding({ existing }: { existing: UserProfile | null }) {
  const [p, setP] = useState<UserProfile>(existing ?? createDefaultProfile());
  const [step, setStep] = useState(0);
  const [addUric, setAddUric] = useState(true);
  const [uricValue, setUricValue] = useState<number | undefined>(7.3);
  const [uricDate, setUricDate] = useState(BASELINE_DATE);
  const [logStartWeight, setLogStartWeight] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<UserProfile>) => setP((cur) => ({ ...cur, ...patch }));

  async function finish() {
    const now = new Date().toISOString();
    const final: UserProfile = { ...p, onboardingCompletedAt: now, updatedAt: now };
    const check = profileSchema.safeParse(final);
    if (!check.success) {
      const issue = check.error.issues[0];
      setError(`Periksa kembali isian "${issue.path.join('.')}": ${issue.message}`);
      return;
    }
    if (addUric && uricValue) {
      await db.labResults.put({ id: newId(), date: uricDate, test: 'Asam urat', value: uricValue, unit: 'mg/dL', note: 'Dicatat saat onboarding' });
    }
    if (logStartWeight) {
      const day = (await db.days.get(p.startingWeightDate)) ?? createEmptyDay(p.startingWeightDate);
      if (day.weightKg == null) await saveDay({ ...day, weightKg: p.startingWeightKg });
    }
    await saveProfile(final);
  }

  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-6">
      <p className="text-xs font-medium uppercase tracking-wide text-accent">
        Langkah {step + 1} dari {STEPS.length} · {STEPS[step]}
      </p>
      <div className="mt-2 mb-5 flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Jejak Sehat</h1>
          <p className="text-[15px] text-muted">
            Pelacak pribadi untuk berat badan, makan, tidur, GERD, puasa, dan aktivitas — dalam satu tempat, supaya kamu bisa melihat hubungan antar kebiasaan dari waktu ke waktu.
          </p>
          <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /> Privasi</span>}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {PRIVACY_TEXT.slice(0, 3).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
          <Note tone="info">
            Aplikasi ini alat bantu catatan & perencanaan, <b>bukan alat medis</b> dan bukan pengganti tenaga kesehatan. Semua angka kalori dan prediksi adalah perkiraan.
          </Note>
          <p className="text-sm text-muted">Data awal sudah diisi dari profilmu (7 Nov 2026). Semua bisa diubah sekarang atau nanti di Pengaturan.</p>
        </div>
      )}

      {step === 1 && <BodyFields p={p} set={set} />}
      {step === 2 && <GoalFields p={p} set={set} />}
      {step === 3 && <NutritionFields p={p} set={set} />}
      {step === 4 && <HabitFields p={p} set={set} />}

      {step === 5 && (
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><Moon className="h-5 w-5 text-accent" /> Tentang tidur</span>}>
            <p className="text-sm">{SLEEP_SAFETY_CARD}</p>
            <p className="mt-2 text-sm text-muted">{DROWSY_DRIVING}</p>
          </Card>
          <Card title="Hasil lab sebelumnya">
            <Toggle label="Catat asam urat ke Log Lab" checked={addUric} onChange={setAddUric} />
            {addUric && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberField label="Asam urat" unit="mg/dL" value={uricValue} min={0} max={20} onChange={setUricValue} />
                <DateField label="Tanggal tes (perkiraan)" value={uricDate} onChange={setUricDate} />
              </div>
            )}
            <p className="mt-2 text-xs text-muted">Aplikasi tidak menafsirkan hasil lab. Diskusikan dengan dokter.</p>
          </Card>
          <Toggle label={`Catat berat awal ${p.startingWeightKg} kg sebagai penimbangan pertama`} checked={logStartWeight} onChange={setLogStartWeight} />
          <Note tone="urgent" title={URGENT_WARNING.title}>
            <ul className="list-disc space-y-0.5 pl-4">
              {URGENT_WARNING.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-1 font-medium">{URGENT_WARNING.action}</p>
          </Note>
          {error && <Note tone="caution">{error}</Note>}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button full onClick={() => setStep((s) => s - 1)}>
            Kembali
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button full variant="primary" onClick={() => setStep((s) => s + 1)}>
            Lanjut
          </Button>
        ) : (
          <Button full variant="primary" onClick={() => void finish()}>
            Mulai
          </Button>
        )}
      </div>
    </div>
  );
}
