import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, Star, Plus, BookOpen, Copy } from 'lucide-react';
import type { MealEntry } from '../domain/types';
import { Badge, Button, NumberField, Sheet, TextField, TimeField, useToast } from './ui';
import { FOOD_LIBRARY, type LibraryFood } from '../domain/foodLibrary';
import { db, newId } from '../db/db';
import { fmt0, fmt1 } from '../lib/format';

const blank = (): MealEntry => ({ id: newId(), name: '', caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, estimate: true, source: 'manual' });

export function MealList({ meals, onChange }: { meals: MealEntry[]; onChange: (m: MealEntry[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const sorted = [...meals].sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));

  async function favorite(m: MealEntry) {
    await db.favorites.put({
      id: newId(),
      name: m.name,
      portionDescription: m.portionDescription,
      caloriesKcal: m.caloriesKcal,
      proteinG: m.proteinG,
      carbsG: m.carbsG,
      fatG: m.fatG,
      estimate: m.estimate,
      createdAt: new Date().toISOString(),
    });
    toast(`"${m.name}" disimpan ke favorit`);
  }

  function remove(m: MealEntry) {
    const before = meals;
    onChange(meals.filter((x) => x.id !== m.id));
    toast(`"${m.name}" dihapus`, () => onChange(before));
  }

  return (
    <div className="space-y-2">
      {sorted.map((m) => (
        <div key={m.id} className="flex items-start gap-2 rounded-xl border border-line bg-field p-3">
          <button type="button" className="min-h-11 flex-1 text-left" onClick={() => setEditing(m)}>
            <p className="text-[15px] font-medium">
              {m.time && <span className="mr-1 text-muted tabular">{m.time}</span>}
              {m.name || 'Tanpa nama'}
            </p>
            <p className="text-xs text-muted tabular">
              {fmt0(m.caloriesKcal)} kkal · P {fmt1(m.proteinG)} · K {fmt1(m.carbsG)} · L {fmt1(m.fatG)} g{m.portionDescription ? ` · ${m.portionDescription}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {m.estimate && <Badge>perkiraan</Badge>}
              {m.source === 'ai-photo' && <Badge tone="info">perkiraan AI{m.ai ? ` ${fmt0(m.ai.kcalMin)}–${fmt0(m.ai.kcalMax)}` : ''}</Badge>}
              {m.source === 'ai-label' && <Badge tone="info">label gizi</Badge>}
            </div>
          </button>
          <button type="button" aria-label={`Simpan ${m.name} ke favorit`} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-soft" onClick={() => void favorite(m)}>
            <Star className="h-5 w-5" />
          </button>
          <button type="button" aria-label={`Hapus ${m.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-soft" onClick={() => remove(m)}>
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
      <MealForm
        meal={editing}
        onClose={() => setEditing(null)}
        onSave={(m) => {
          onChange(meals.map((x) => (x.id === m.id ? m : x)));
          setEditing(null);
        }}
      />
    </div>
  );
}

export function MealForm({ meal, onClose, onSave, title = 'Ubah makanan' }: { meal: MealEntry | null; onClose: () => void; onSave: (m: MealEntry) => void; title?: string }) {
  const [m, setM] = useState<MealEntry | null>(meal);
  const [key, setKey] = useState(meal?.id);
  if (meal?.id !== key) {
    setKey(meal?.id);
    setM(meal);
  }
  if (!m) return null;
  const set = (p: Partial<MealEntry>) => setM((cur) => (cur ? { ...cur, ...p } : cur));
  return (
    <Sheet open={!!meal} onClose={onClose} title={title}>
      <TextField label="Nama makanan/minuman" value={m.name} onChange={(v) => set({ name: v })} placeholder="mis. Nasi + ayam bakar + lalapan" />
      <div className="grid grid-cols-2 gap-3">
        <TimeField label="Jam" value={m.time} onChange={(v) => set({ time: v })} />
        <TextField label="Porsi" value={m.portionDescription} onChange={(v) => set({ portionDescription: v })} placeholder="mis. 1 piring" />
        <NumberField label="Kalori" unit="kkal" value={m.caloriesKcal} min={0} max={5000} onChange={(v) => set({ caloriesKcal: v ?? 0 })} />
        <NumberField label="Protein" unit="g" value={m.proteinG} min={0} max={500} onChange={(v) => set({ proteinG: v ?? 0 })} />
        <NumberField label="Karbohidrat" unit="g" value={m.carbsG} min={0} max={1000} onChange={(v) => set({ carbsG: v ?? 0 })} />
        <NumberField label="Lemak" unit="g" value={m.fatG} min={0} max={500} onChange={(v) => set({ fatG: v ?? 0 })} />
      </div>
      <p className="text-xs text-muted">Jangan lupa minyak, santan, saus, dan minuman — tambahkan sebagai item terpisah bila perlu.</p>
      <Button full variant="primary" disabled={!m.name.trim()} onClick={() => onSave({ ...m, name: m.name.trim() })}>
        Simpan
      </Button>
    </Sheet>
  );
}

export function AddMealButtons({ onAdd, onCopyYesterday }: { onAdd: (m: MealEntry[]) => void; onCopyYesterday?: () => void }) {
  const [form, setForm] = useState<MealEntry | null>(null);
  const [picker, setPicker] = useState(false);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setForm(blank())}>
          <Plus className="h-4 w-4" /> Tambah manual
        </Button>
        <Button onClick={() => setPicker(true)}>
          <BookOpen className="h-4 w-4" /> Favorit & contoh
        </Button>
        {onCopyYesterday && (
          <Button className="col-span-2" onClick={onCopyYesterday}>
            <Copy className="h-4 w-4" /> Sama seperti kemarin
          </Button>
        )}
      </div>
      <MealForm
        title="Tambah makanan"
        meal={form}
        onClose={() => setForm(null)}
        onSave={(m) => {
          onAdd([m]);
          setForm(null);
        }}
      />
      <FoodPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(m) => {
          onAdd([m]);
          setPicker(false);
        }}
      />
    </>
  );
}

function FoodPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: MealEntry) => void }) {
  const favorites = useLiveQuery(() => db.favorites.orderBy('name').toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [qty, setQty] = useState<number | undefined>(1);
  const filt = (n: string) => n.toLowerCase().includes(q.trim().toLowerCase());
  const nowT = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const scale = (x: number) => Math.round(x * (qty ?? 1) * 10) / 10;
  const fromLib = (f: LibraryFood): MealEntry => ({
    id: newId(),
    name: f.name,
    time: nowT(),
    portionDescription: `${qty !== 1 ? `${fmt1(qty)} × ` : ''}${f.portion}`,
    caloriesKcal: Math.round(f.caloriesKcal * (qty ?? 1)),
    proteinG: scale(f.proteinG),
    carbsG: scale(f.carbsG),
    fatG: scale(f.fatG),
    estimate: true,
    source: 'library',
  });
  return (
    <Sheet open={open} onClose={onClose} title="Favorit & contoh makanan">
      <TextField label="Cari" value={q} onChange={setQ} placeholder="mis. tempe" />
      <NumberField label="Jumlah porsi" value={qty} min={0.25} max={20} onChange={setQty} />
      {favorites.filter((f) => filt(f.name)).length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Favoritmu</p>
          <div className="space-y-2">
            {favorites
              .filter((f) => filt(f.name))
              .map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl border border-line bg-field p-3 text-left"
                    onClick={() =>
                      onPick({
                        id: newId(),
                        name: f.name,
                        time: nowT(),
                        portionDescription: `${qty !== 1 ? `${fmt1(qty)} × ` : ''}${f.portionDescription ?? 'porsi'}`,
                        caloriesKcal: Math.round(f.caloriesKcal * (qty ?? 1)),
                        proteinG: scale(f.proteinG),
                        carbsG: scale(f.carbsG),
                        fatG: scale(f.fatG),
                        estimate: f.estimate,
                        source: 'favorite',
                      })
                    }
                  >
                    <p className="text-[15px] font-medium">{f.name}</p>
                    <p className="text-xs text-muted">
                      {fmt0(f.caloriesKcal)} kkal · P {fmt1(f.proteinG)} g {f.portionDescription ? `· ${f.portionDescription}` : ''}
                    </p>
                  </button>
                  <button type="button" aria-label={`Hapus favorit ${f.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted" onClick={() => void db.favorites.delete(f.id)}>
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1 text-sm font-semibold">Contoh (semua angka perkiraan)</p>
        <p className="mb-2 text-xs text-muted">Porsi warung berbeda-beda; sesuaikan setelah ditambahkan.</p>
        <div className="space-y-2">
          {FOOD_LIBRARY.filter((f) => filt(f.name)).map((f) => (
            <button key={f.id} type="button" className="block min-h-11 w-full rounded-xl border border-line bg-field p-3 text-left" onClick={() => onPick(fromLib(f))}>
              <p className="text-[15px] font-medium">{f.name}</p>
              <p className="text-xs text-muted">
                {f.portion} · {fmt0(f.caloriesKcal)} kkal · P {fmt1(f.proteinG)} g
              </p>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
