import { useState } from 'react';
import { Loader2, Sparkles, Plus } from 'lucide-react';
import type { MealEntry, UserProfile } from '../domain/types';
import { Button, Note, Segmented, Sheet, TextField, Toggle } from './ui';
import { suggestMenu } from '../ai/features';
import type { MenuResult } from '../ai/schemas';
import { AiError } from '../ai/client';
import { newId } from '../db/db';
import { fmt0 } from '../lib/format';

const CONTEXTS = [
  { id: 'kantin kantor', label: 'Kantin kantor' },
  { id: 'warung/warteg', label: 'Warung/warteg' },
  { id: 'masak sendiri', label: 'Masak sendiri' },
  { id: 'minimarket', label: 'Minimarket' },
  { id: 'pesan online', label: 'Pesan online' },
];

export function MenuSheet({ open, onClose, profile, remainingKcal, remainingProtein, onAdd, defaultGerd, defaultUric }: {
  open: boolean; onClose: () => void; profile: UserProfile; remainingKcal: number; remainingProtein: number; onAdd: (m: MealEntry) => void; defaultGerd: boolean; defaultUric: boolean;
}) {
  const [ctx, setCtx] = useState<string | undefined>('kantin kantor');
  const [gerd, setGerd] = useState(defaultGerd);
  const [uric, setUric] = useState(defaultUric);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<MenuResult | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setRes(await suggestMenu({ remainingKcal, remainingProteinG: remainingProtein, context: ctx ?? 'bebas', gerd, uricAcid: uric, note: note.trim() || undefined }, profile));
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'Gagal mengambil saran.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={() => { setRes(null); onClose(); }} title="Saran menu dari sisa kebutuhan">
      <p className="text-sm">
        Sisa hari ini (perkiraan): <b className="tabular">{fmt0(Math.max(0, remainingKcal))} kkal</b>, protein <b className="tabular">{fmt0(Math.max(0, remainingProtein))} g</b>.
      </p>
      <Segmented label="Di mana kamu makan?" options={CONTEXTS} value={ctx} onChange={setCtx} />
      <Toggle label="Pertimbangkan GERD" checked={gerd} onChange={setGerd} />
      <Toggle label="Pertimbangkan asam urat" checked={uric} onChange={setUric} />
      <TextField label="Catatan (opsional)" value={note} onChange={setNote} placeholder="mis. budget 30 ribu, tidak suka ikan" />
      <Button full variant="primary" disabled={busy} onClick={() => void run()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Minta 3 opsi
      </Button>
      {err && <Note tone="caution">{err}</Note>}
      {res?.options.map((o) => (
        <div key={o.name} className="space-y-1 rounded-xl border border-line bg-field p-3">
          <p className="font-medium">{o.name}</p>
          <p className="text-sm text-muted">{o.description}</p>
          <p className="text-xs tabular">
            ±{fmt0(o.kcal)} kkal · P {fmt0(o.protein_g)} · K {fmt0(o.carbs_g)} · L {fmt0(o.fat_g)} g (perkiraan)
          </p>
          <p className="text-xs text-muted">{o.why}</p>
          <Button
            variant="ghost"
            onClick={() => {
              onAdd({ id: newId(), name: o.name, caloriesKcal: o.kcal, proteinG: o.protein_g, carbsG: o.carbs_g, fatG: o.fat_g, estimate: true, source: 'ai-menu', portionDescription: o.description.slice(0, 120) });
              setRes(null);
              onClose();
            }}
          >
            <Plus className="h-4 w-4" /> Saya makan ini
          </Button>
        </div>
      ))}
      {res?.note && <Note tone="info">{res.note}</Note>}
    </Sheet>
  );
}
