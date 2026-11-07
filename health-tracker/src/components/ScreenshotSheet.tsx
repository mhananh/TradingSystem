import { useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import type { DailyEntry } from '../domain/types';
import { Button, Note, Sheet } from './ui';
import { pickImage } from '../lib/image';
import { prepareImage, readHealthScreenshot, type PreparedImage } from '../ai/features';
import type { ScreenshotResult } from '../ai/schemas';
import { AiError } from '../ai/client';
import { mergeDeviceData } from '../integrations/merge';
import { sleepFromClockTimes } from '../domain/calc';
import { formatMinutes } from '../lib/date';
import { fmt0 } from '../lib/format';

/** Fallback for data Health Sync doesn't carry: screenshot of Huawei Health → AI reads the numbers. */
export function ScreenshotSheet({ open, onClose, day, onApply }: { open: boolean; onClose: () => void; day: DailyEntry; onApply: (d: DailyEntry, changed: string[]) => void }) {
  const [img, setImg] = useState<PreparedImage | null>(null);
  const [res, setRes] = useState<ScreenshotResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    setImg(null);
    setRes(null);
    setErr(null);
    onClose();
  };

  async function pick() {
    const b = await pickImage(false);
    if (!b) return;
    setImg(await prepareImage(b, 1400, 0.85));
    setRes(null);
  }

  async function analyze() {
    if (!img) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(await readHealthScreenshot(img));
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'Gagal membaca screenshot.');
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!res) return;
    const sleep = res.bedtime && res.wake_time ? sleepFromClockTimes(day.date, res.bedtime, res.wake_time) : null;
    const { entry, changed, skippedManual } = mergeDeviceData(
      day,
      {
        steps: res.steps,
        sleepMinutes: res.sleep_total_minutes ?? sleep?.minutes,
        sleepStartAt: sleep?.sleepStartAt,
        wakeAt: sleep?.wakeAt,
        restingHr: res.resting_hr,
        spo2Min: res.spo2_min,
      },
      'screenshot',
    );
    onApply(entry, skippedManual.length ? [...changed, `(tidak menimpa isian manual: ${skippedManual.join(', ')})`] : changed);
    close();
  }

  return (
    <Sheet open={open} onClose={close} title="Isi dari screenshot jam">
      <p className="text-sm text-muted">Buka Huawei Health → halaman Tidur/Langkah, ambil screenshot, lalu pilih di sini. Data diisi ke tanggal yang sedang dibuka.</p>
      {!img ? (
        <Button full variant="primary" onClick={() => void pick()}>
          <ImageIcon className="h-5 w-5" /> Pilih screenshot
        </Button>
      ) : (
        <img src={img.previewUrl} alt="Screenshot yang dipilih" className="max-h-64 w-full rounded-xl object-contain" />
      )}
      {img && !res && (
        <Button full variant="primary" disabled={busy} onClick={() => void analyze()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Baca angka
        </Button>
      )}
      {err && <Note tone="caution">{err}</Note>}
      {res && !res.readable && <Note tone="info">Tidak ada data kesehatan yang terbaca. Coba screenshot lain.</Note>}
      {res && res.readable && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-field p-3 text-sm">
            <dt className="text-muted">Total tidur</dt>
            <dd className="tabular">{formatMinutes(res.sleep_total_minutes)}</dd>
            <dt className="text-muted">Tidur → bangun</dt>
            <dd className="tabular">{res.bedtime ?? '–'} → {res.wake_time ?? '–'}</dd>
            <dt className="text-muted">Langkah</dt>
            <dd className="tabular">{fmt0(res.steps)}</dd>
            <dt className="text-muted">Nadi istirahat</dt>
            <dd className="tabular">{res.resting_hr ?? '–'} bpm</dd>
            <dt className="text-muted">SpO2 terendah</dt>
            <dd className="tabular">{res.spo2_min ?? '–'}%</dd>
          </dl>
          {res.date_shown && res.date_shown !== day.date && (
            <Note tone="caution">Screenshot tampaknya untuk tanggal {res.date_shown}, sedangkan catatan yang dibuka {day.date}. Pastikan tanggalnya benar.</Note>
          )}
          <p className="text-xs text-muted">Periksa angkanya. Isian manual yang sudah ada tidak akan ditimpa.</p>
          <Button full variant="primary" onClick={apply}>
            Pakai angka ini
          </Button>
        </div>
      )}
    </Sheet>
  );
}
