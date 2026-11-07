import { useState } from 'react';
import { Camera, Loader2, Sparkles, Tag } from 'lucide-react';
import type { MealEntry, UserProfile } from '../domain/types';
import { Button, Note, NumberField, Segmented, Sheet, TextField, TimeField, Badge } from './ui';
import { pickImage } from '../lib/image';
import { estimateFoodPhoto, prepareImage, readNutritionLabel, refineFoodEstimate, type PreparedImage } from '../ai/features';
import type { FoodPhotoResult, NutritionLabelResult } from '../ai/schemas';
import { AiError, getAiSettings } from '../ai/client';
import { newId } from '../db/db';
import { fmt0, fmt1 } from '../lib/format';

type Mode = 'photo' | 'label';

function nowHHmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AiFoodSheet({ open, onClose, profile, onAdd, initialMode = 'photo' }: { open: boolean; onClose: () => void; profile: UserProfile; onAdd: (meals: MealEntry[]) => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FoodPhotoResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [label, setLabel] = useState<NutritionLabelResult | null>(null);
  const [servings, setServings] = useState<number | undefined>(1);
  const [time, setTime] = useState<string | undefined>(nowHHmm());
  const [model, setModel] = useState<{ provider: 'claude' | 'gemini'; model: string } | null>(null);

  const reset = () => {
    setImage(null);
    setResult(null);
    setLabel(null);
    setAnswers({});
    setError(null);
    setNote('');
    setServings(1);
    setTime(nowHHmm());
  };
  const close = () => {
    reset();
    onClose();
  };

  async function take(preferCamera: boolean) {
    setError(null);
    const blob = await pickImage(preferCamera);
    if (!blob) return;
    try {
      setImage(await prepareImage(blob));
      setResult(null);
      setLabel(null);
    } catch {
      setError('Gambar tidak bisa dibaca. Coba gambar lain.');
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      const s = await getAiSettings();
      setModel({ provider: s.provider, model: s.provider === 'claude' ? s.claudeVisionModel : s.geminiModel });
      await fn();
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Terjadi kesalahan. Coba lagi atau isi manual.');
    } finally {
      setBusy(false);
    }
  }

  const analyze = () =>
    run(async () => {
      if (!image) return;
      if (mode === 'photo') setResult(await estimateFoodPhoto(image, profile, note.trim() || undefined));
      else setLabel(await readNutritionLabel(image));
    });

  const refine = () =>
    run(async () => {
      if (!result) return;
      const qa = result.questions.map((q, i) => ({ question: q.question, answer: answers[i] })).filter((x) => x.answer);
      if (!qa.length) return;
      setResult(await refineFoodEstimate(result, qa, profile));
    });

  function editItem(i: number, patch: Partial<FoodPhotoResult['items'][number]>) {
    setResult((r) => (r ? { ...r, items: r.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : r));
  }

  function savePhoto() {
    if (!result || !model) return;
    const meals: MealEntry[] = result.items.map((it) => ({
      id: newId(),
      name: it.name,
      time,
      portionDescription: it.portion,
      caloriesKcal: Math.round(it.kcal),
      proteinG: it.protein_g,
      carbsG: it.carbs_g,
      fatG: it.fat_g,
      estimate: true,
      source: 'ai-photo',
      ai: { ...model, kcalMin: it.kcal_min, kcalMax: it.kcal_max, confidence: result.confidence, assumptions: result.assumptions },
    }));
    onAdd(meals);
    close();
  }

  function saveLabel() {
    if (!label || !servings) return;
    const m = (n: number | null) => Math.round((n ?? 0) * servings * 10) / 10;
    onAdd([
      {
        id: newId(),
        name: label.product_name || 'Produk kemasan',
        time,
        portionDescription: `${fmt1(servings)} × ${label.serving_description ?? 'sajian'}`,
        caloriesKcal: Math.round((label.per_serving_kcal ?? 0) * servings),
        proteinG: m(label.per_serving_protein_g),
        carbsG: m(label.per_serving_carbs_g),
        fatG: m(label.per_serving_fat_g),
        estimate: false,
        source: 'ai-label',
      },
    ]);
    close();
  }

  const total = result?.items.reduce((s, i) => ({ kcal: s.kcal + i.kcal, lo: s.lo + i.kcal_min, hi: s.hi + i.kcal_max, p: s.p + i.protein_g }), { kcal: 0, lo: 0, hi: 0, p: 0 });

  return (
    <Sheet open={open} onClose={close} title={mode === 'photo' ? 'Foto makanan → perkiraan kalori' : 'Foto label gizi'}>
      <Segmented
        options={[
          { id: 'photo', label: 'Foto makanan' },
          { id: 'label', label: 'Label gizi kemasan' },
        ]}
        value={mode}
        allowClear={false}
        onChange={(v) => {
          if (v) {
            setMode(v);
            setResult(null);
            setLabel(null);
          }
        }}
      />
      {!image ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => void take(true)}>
            <Camera className="h-5 w-5" /> Kamera
          </Button>
          <Button onClick={() => void take(false)}>Pilih dari galeri</Button>
        </div>
      ) : (
        <img src={image.previewUrl} alt="Foto yang akan dianalisis" className="max-h-56 w-full rounded-xl object-cover" />
      )}
      {image && !result && !label && (
        <>
          {mode === 'photo' && <TextField label="Catatan (opsional)" placeholder="mis. nasi 1,5 centong, ayam digoreng" value={note} onChange={setNote} />}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setImage(null)}>Ganti foto</Button>
            <Button variant="primary" disabled={busy} onClick={() => void analyze()}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'photo' ? <Sparkles className="h-5 w-5" /> : <Tag className="h-5 w-5" />} Analisis
            </Button>
          </div>
          <p className="text-xs text-muted">Foto dikecilkan lalu dikirim ke penyedia AI pilihanmu. Hasil adalah perkiraan dan bisa kamu ubah sebelum disimpan.</p>
        </>
      )}
      {error && <Note tone="caution">{error}</Note>}

      {result && !result.is_food && <Note tone="info">Tidak terlihat makanan di foto ini. Coba foto lain atau isi manual.</Note>}
      {result && result.is_food && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Total ±{fmt0(total!.kcal)} kkal <span className="text-muted">({fmt0(total!.lo)}–{fmt0(total!.hi)})</span> · protein {fmt0(total!.p)} g
            </p>
            <Badge tone={result.confidence === 'high' ? 'accent' : result.confidence === 'medium' ? 'info' : 'caution'}>
              keyakinan {result.confidence === 'high' ? 'tinggi' : result.confidence === 'medium' ? 'sedang' : 'rendah'}
            </Badge>
          </div>
          {result.questions.length > 0 && (
            <div className="space-y-3 rounded-xl bg-info-soft p-3">
              <p className="text-sm font-medium">Supaya lebih tepat:</p>
              {result.questions.map((q, i) => (
                <Segmented key={q.question} label={q.question} options={q.options.map((o) => ({ id: o, label: o }))} value={answers[i]} onChange={(v) => setAnswers((a) => ({ ...a, [i]: v ?? '' }))} />
              ))}
              <Button full disabled={busy || !Object.values(answers).some(Boolean)} onClick={() => void refine()}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Perbarui perkiraan
              </Button>
            </div>
          )}
          {result.items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line bg-field p-3">
              <TextField label="Nama" value={it.name} onChange={(v) => editItem(i, { name: v })} />
              <p className="text-xs text-muted">
                {it.portion} · rentang {fmt0(it.kcal_min)}–{fmt0(it.kcal_max)} kkal
              </p>
              <div className="grid grid-cols-4 gap-2">
                <NumberField label="kkal" value={it.kcal} min={0} max={5000} onChange={(v) => editItem(i, { kcal: v ?? 0 })} />
                <NumberField label="P (g)" value={it.protein_g} min={0} max={500} onChange={(v) => editItem(i, { protein_g: v ?? 0 })} />
                <NumberField label="K (g)" value={it.carbs_g} min={0} max={1000} onChange={(v) => editItem(i, { carbs_g: v ?? 0 })} />
                <NumberField label="L (g)" value={it.fat_g} min={0} max={500} onChange={(v) => editItem(i, { fat_g: v ?? 0 })} />
              </div>
              <Button variant="ghost" onClick={() => setResult((r) => (r ? { ...r, items: r.items.filter((_, j) => j !== i) } : r))}>
                Hapus item ini
              </Button>
            </div>
          ))}
          {result.assumptions.length > 0 && (
            <div className="text-xs text-muted">
              <p className="font-medium">Asumsi AI:</p>
              <ul className="list-disc pl-4">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {result.gerd_note && <Note tone="info">{result.gerd_note}</Note>}
          <TimeField label="Jam makan" value={time} onChange={setTime} />
          <Button full variant="primary" disabled={!result.items.length} onClick={savePhoto}>
            Simpan {result.items.length} item (perkiraan AI)
          </Button>
        </div>
      )}

      {label && !label.readable && <Note tone="info">Label tidak terbaca. Coba foto lebih dekat dan terang, atau isi manual.</Note>}
      {label && label.readable && (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-field p-3 text-sm">
            <p className="font-medium">{label.product_name ?? 'Produk'}</p>
            <p className="text-muted">Per sajian ({label.serving_description ?? '–'}): {fmt0(label.per_serving_kcal)} kkal · P {fmt1(label.per_serving_protein_g)} g · K {fmt1(label.per_serving_carbs_g)} g · L {fmt1(label.per_serving_fat_g)} g</p>
            {label.servings_per_package && <p className="text-muted">{fmt1(label.servings_per_package)} sajian per kemasan</p>}
          </div>
          <NumberField label="Jumlah sajian yang dimakan" value={servings} min={0.1} max={50} onChange={setServings} />
          <TimeField label="Jam makan" value={time} onChange={setTime} />
          <Button full variant="primary" disabled={!servings} onClick={saveLabel}>
            Simpan
          </Button>
        </div>
      )}
    </Sheet>
  );
}
