import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DailyEntry, GerdEpisode } from '../domain/types';
import { Button, Chips, Note, Segmented, Sheet, TextField, TimeField, Badge, useToast } from './ui';
import { GERD_CONTEXT, GERD_SYMPTOMS, GERD_TRIGGERS } from '../domain/defaults';
import { newId } from '../db/db';
import { combineDateTime } from '../lib/date';
import { URGENT_WARNING } from '../copy/health';

const SEVERITY = [
  { id: 'mild', label: 'Ringan' },
  { id: 'moderate', label: 'Sedang' },
  { id: 'severe', label: 'Berat' },
] as const;

/** Was this time inside the fast logged for the day? */
export function duringLoggedFast(day: DailyEntry, time?: string): boolean | undefined {
  if (!time || !day.fastingStartAt || !day.fastingEndAt) return undefined;
  const t = combineDateTime(day.date, time).getTime();
  return t >= new Date(day.fastingStartAt).getTime() && t <= new Date(day.fastingEndAt).getTime();
}

export function GerdEditor({ day, onChange }: { day: DailyEntry; onChange: (patch: Partial<DailyEntry>) => void }) {
  const toast = useToast();
  const [ep, setEp] = useState<GerdEpisode | null>(null);
  const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

  function save(e: GerdEpisode) {
    const fast = duringLoggedFast(day, e.time);
    const context = fast && !e.context.includes('during_fast') ? [...e.context, 'during_fast'] : e.context;
    const next = { ...e, context, duringFast: fast ?? e.context.includes('during_fast') };
    const exists = day.gerdEpisodes.some((x) => x.id === e.id);
    onChange({ gerdAny: true, gerdEpisodes: exists ? day.gerdEpisodes.map((x) => (x.id === e.id ? next : x)) : [...day.gerdEpisodes, next] });
    setEp(null);
  }

  function remove(e: GerdEpisode) {
    const before = day.gerdEpisodes;
    onChange({ gerdEpisodes: before.filter((x) => x.id !== e.id) });
    toast('Episode dihapus', () => onChange({ gerdEpisodes: before }));
  }

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <Segmented
        label="Ada gejala GERD hari ini?"
        options={[
          { id: 'no', label: 'Tidak ada' },
          { id: 'yes', label: 'Ada' },
        ]}
        value={day.gerdEpisodes.length ? 'yes' : day.gerdAny == null ? undefined : day.gerdAny ? 'yes' : 'no'}
        onChange={(v) => onChange({ gerdAny: v == null ? undefined : v === 'yes' })}
      />
      {day.gerdEpisodes.map((e) => (
        <div key={e.id} className="flex items-start gap-2 rounded-xl border border-line bg-field p-3">
          <button type="button" className="min-h-11 flex-1 text-left" onClick={() => setEp(e)}>
            <p className="text-[15px] font-medium">
              {e.time ?? '–'} · {label(SEVERITY, e.severity)}
              {e.duringFast && <Badge tone="info">saat puasa</Badge>}
            </p>
            <p className="text-xs text-muted">{[...e.symptoms.map((s) => label(GERD_SYMPTOMS, s)), ...e.triggers.map((s) => `pemicu?: ${label(GERD_TRIGGERS, s)}`)].join(' · ') || 'Tanpa detail'}</p>
          </button>
          <button type="button" aria-label="Hapus episode" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted" onClick={() => remove(e)}>
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
      <Button onClick={() => setEp({ id: newId(), time: now(), severity: 'mild', symptoms: [], context: [], triggers: [] })}>
        <Plus className="h-4 w-4" /> Tambah episode
      </Button>
      <Sheet open={!!ep} onClose={() => setEp(null)} title="Episode GERD">
        {ep && (
          <>
            <TimeField label="Kira-kira jam" value={ep.time} onChange={(v) => setEp({ ...ep, time: v })} />
            <Segmented label="Keparahan" options={SEVERITY} value={ep.severity} allowClear={false} onChange={(v) => v && setEp({ ...ep, severity: v })} />
            {ep.severity === 'severe' && (
              <Note tone="urgent" title={URGENT_WARNING.title}>
                {URGENT_WARNING.items.slice(0, 4).join('; ')}. {URGENT_WARNING.action}
              </Note>
            )}
            <Chips label="Jenis gejala" options={GERD_SYMPTOMS} value={ep.symptoms} onChange={(v) => setEp({ ...ep, symptoms: v })} />
            <Chips label="Kapan" options={GERD_CONTEXT} value={ep.context} onChange={(v) => setEp({ ...ep, context: v })} />
            <Chips label="Kemungkinan pemicu (bukan kepastian)" options={GERD_TRIGGERS} value={ep.triggers} onChange={(v) => setEp({ ...ep, triggers: v })} />
            <TextField label="Catatan (opsional)" multiline value={ep.note} onChange={(v) => setEp({ ...ep, note: v })} />
            <Button full variant="primary" onClick={() => save(ep)}>
              Simpan episode
            </Button>
          </>
        )}
      </Sheet>
    </div>
  );
}
