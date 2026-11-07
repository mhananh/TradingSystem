import { useEffect, useState } from 'react';
import { Download, Upload, Trash2, ShieldCheck, KeyRound, Watch, Bell, Loader2, ExternalLink } from 'lucide-react';
import type { BackupFile, UserProfile } from '../domain/types';
import { saveProfile, useAllDays } from '../hooks/data';
import { BodyFields, GoalFields, HabitFields, NutritionFields } from '../components/ProfileForm';
import { Button, ConfirmDialog, Note, Section, Segmented, TextField, TimeField, Toggle, useToast, Badge } from '../components/ui';
import { profileSchema, parseBackup } from '../domain/validation';
import { applyImport, deleteAllData, exportAll, getMeta, previewImport, setMeta, type ImportPreview } from '../db/db';
import { backupFileName, backupJson, dailyCsv, gerdCsv, mealsCsv } from '../lib/export';
import { isAndroid, isNative, isStoragePersistent, requestPersistentStorage, shareOrDownload } from '../lib/platform';
import { PRIVACY_TEXT } from '../copy/health';
import { CLAUDE_MODELS, DEFAULT_AI_SETTINGS, getAiSettings, saveAiSettings, testConnection, usageThisMonth, AiError, type AiSettings } from '../ai/client';
import { getApiKey, maskKey, setApiKey } from '../ai/secrets';
import { getHealthConnectStatus, lastHealthConnectSync, openHealthConnectSettings, requestHealthConnect, syncFromHealthConnect, type HcStatus } from '../integrations/healthConnect';
import { applyReminders, getReminderPrefs, type ReminderPrefs } from '../integrations/notifications';
import { currentWeightEstimate } from '../domain/derive';
import { formatMedium, todayKey } from '../lib/date';
import { fmt2 } from '../lib/format';

export const APP_VERSION = '1.0.0';

export default function Pengaturan({ profile }: { profile: UserProfile; sub?: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Pengaturan</h1>
      <ProfileSettings profile={profile} />
      <AiSettingsCard />
      <IntegrationsCard />
      <RemindersCard />
      <DataCard />
      <Section title="Privasi & tentang" icon={<ShieldCheck className="h-5 w-5" />} summary={`Versi ${APP_VERSION}`}>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {PRIVACY_TEXT.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">Jejak Sehat v{APP_VERSION}. Alat bantu pencatatan, bukan alat medis.</p>
      </Section>
    </div>
  );
}

function ProfileSettings({ profile }: { profile: UserProfile }) {
  const days = useAllDays();
  const toast = useToast();
  const [p, setP] = useState(profile);
  const [confirmFloor, setConfirmFloor] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setP(profile), [profile]);
  const set = (patch: Partial<UserProfile>) => setP((c) => ({ ...c, ...patch }));
  const dirty = JSON.stringify(p) !== JSON.stringify(profile);
  const cw = days ? currentWeightEstimate(days, profile) : null;

  async function save(force = false) {
    const r = profileSchema.safeParse(p);
    if (!r.success) {
      setErr(`Periksa "${r.error.issues[0].path.join('.')}": ${r.error.issues[0].message}`);
      return;
    }
    if (p.calorieTargetKcal < p.calorieFloorKcal && !force) {
      setConfirmFloor(true);
      return;
    }
    setErr(null);
    await saveProfile(p);
    toast('Profil & target disimpan');
  }

  const SaveBar = () =>
    dirty ? (
      <div className="flex gap-2">
        <Button full onClick={() => setP(profile)}>Batalkan</Button>
        <Button full variant="primary" onClick={() => void save()}>Simpan perubahan</Button>
      </div>
    ) : null;

  return (
    <>
      <Section title="Profil tubuh" summary={`${p.ageYears} th · ${p.heightCm} cm · awal ${p.startingWeightKg} kg`}>
        <BodyFields p={p} set={set} />
        <SaveBar />
      </Section>
      <Section title="Target berat & tanggal" summary={`${p.goalWeightKg} kg${p.targetDate ? ` · ${formatMedium(p.targetDate)}` : ''}`}>
        <GoalFields p={p} set={set} currentWeight={cw} />
        <SaveBar />
      </Section>
      <Section title="Kalori & makro" summary={`${p.calorieTargetKcal} kkal · P ${p.proteinTargetG} · L ${p.fatTargetG} · K ${p.carbTargetG}`}>
        <NutritionFields p={p} set={set} currentWeight={cw} />
        <SaveBar />
      </Section>
      <Section title="Puasa, Ramadan, tidur & langkah" summary={`${p.fastingEnabled ? `IF ${p.eatingWindowStart}–${p.eatingWindowEnd}` : 'IF tidak aktif'}${p.ramadanEnabled ? ' · Ramadan aktif' : ''}`}>
        <HabitFields p={p} set={set} />
        <SaveBar />
      </Section>
      {err && <Note tone="caution">{err}</Note>}
      <ConfirmDialog
        open={confirmFloor}
        title="Target di bawah batas aman"
        body={
          <>
            Target {p.calorieTargetKcal} kkal di bawah batas aman {p.calorieFloorKcal} kkal. Asupan lebih rendah <b>tidak</b> otomatis lebih baik, dan bisa mengorbankan otot, energi, serta memengaruhi asam urat. Lanjutkan hanya bila
            didampingi tenaga kesehatan.
          </>
        }
        confirmLabel="Saya mengerti, simpan"
        onCancel={() => setConfirmFloor(false)}
        onConfirm={() => {
          setConfirmFloor(false);
          void save(true);
        }}
      />
    </>
  );
}

function AiSettingsCard() {
  const toast = useToast();
  const [s, setS] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [keys, setKeys] = useState<{ claude: string | null; gemini: string | null }>({ claude: null, gemini: null });
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{ calls: number; usd: number; tokens: number } | null>(null);
  useEffect(() => {
    void (async () => {
      setS(await getAiSettings());
      setKeys({ claude: await getApiKey('claude'), gemini: await getApiKey('gemini') });
      setUsage(await usageThisMonth());
    })();
  }, []);
  const update = async (patch: Partial<AiSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveAiSettings(next);
  };
  const curKey = keys[s.provider];
  return (
    <Section title="AI (opsional)" icon={<KeyRound className="h-5 w-5" />} summary={s.enabled ? `Aktif · ${s.provider === 'claude' ? 'Claude' : 'Gemini'}` : 'Tidak aktif'}>
      <Note tone="info">
        Fitur AI mengirim foto makanan/label/screenshot, atau ringkasan statistik mingguan, ke penyedia AI saat kamu memakainya. Catatan bebas & identitas tidak dikirim. Butuh internet dan API key milikmu (berbayar sesuai pemakaian).
      </Note>
      <Toggle
        label="Aktifkan fitur AI"
        hint={s.consentAt ? `Disetujui ${formatMedium(s.consentAt.slice(0, 10))}` : 'Dengan mengaktifkan, kamu menyetujui pengiriman data di atas'}
        checked={s.enabled}
        onChange={(v) => void update({ enabled: v, consentAt: v ? (s.consentAt ?? new Date().toISOString()) : s.consentAt })}
      />
      <Segmented
        label="Penyedia"
        options={[
          { id: 'claude', label: 'Claude (Anthropic)' },
          { id: 'gemini', label: 'Gemini (Google AI Studio)' },
        ]}
        value={s.provider}
        allowClear={false}
        onChange={(v) => v && void update({ provider: v })}
      />
      <div className="rounded-xl bg-soft p-3 text-sm">
        <p>
          API key {s.provider === 'claude' ? 'Claude' : 'Gemini'}: <span className="font-mono">{maskKey(curKey)}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {isNative() ? 'Disimpan terenkripsi di HP ini (Android Keystore).' : 'Versi web: disimpan di penyimpanan browser perangkat ini (kurang aman dibanding aplikasi Android).'} Key tidak pernah dikirim ke tempat lain selain penyedia AI.
        </p>
      </div>
      <TextField label="Tempel API key baru" type="password" value={newKey} onChange={setNewKey} placeholder={s.provider === 'claude' ? 'sk-ant-…' : 'AIza…'} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          disabled={!newKey.trim()}
          onClick={async () => {
            await setApiKey(s.provider, newKey);
            setKeys((k) => ({ ...k, [s.provider]: newKey.trim() }));
            setNewKey('');
            toast('API key disimpan');
          }}
        >
          Simpan key
        </Button>
        <Button
          disabled={!curKey}
          onClick={async () => {
            await setApiKey(s.provider, '');
            setKeys((k) => ({ ...k, [s.provider]: null }));
            toast('API key dihapus dari perangkat');
          }}
        >
          Hapus key
        </Button>
      </div>
      {s.provider === 'claude' ? (
        <div className="space-y-3">
          <Segmented label="Model untuk foto/label/screenshot" options={CLAUDE_MODELS.map((m) => ({ id: m.id, label: m.label }))} value={s.claudeVisionModel} allowClear={false} onChange={(v) => v && void update({ claudeVisionModel: v })} />
          <Segmented label="Model untuk review mingguan & menu" options={CLAUDE_MODELS.map((m) => ({ id: m.id, label: m.label }))} value={s.claudeTextModel} allowClear={false} onChange={(v) => v && void update({ claudeTextModel: v })} />
          <Segmented
            label="Effort (tingkat berpikir)"
            options={[
              { id: 'low', label: 'Low (hemat)' },
              { id: 'medium', label: 'Medium' },
              { id: 'high', label: 'High' },
            ]}
            value={s.claudeEffort}
            allowClear={false}
            onChange={(v) => v && void update({ claudeEffort: v })}
          />
          <p className="text-xs text-muted">
            Butuh API key dari console.anthropic.com (terpisah dari langganan Claude Pro/Max; langganan tidak bisa dipakai di aplikasi buatan sendiri). Pasang batas pengeluaran (spend limit) di console agar aman.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <TextField label="Nama model Gemini" value={s.geminiModel} onChange={(v) => void update({ geminiModel: v.trim() || DEFAULT_AI_SETTINGS.geminiModel })} />
          <p className="text-xs text-muted">
            Key dari aistudio.google.com. Catatan privasi: pada tingkat gratis, Google dapat memakai data yang dikirim untuk meningkatkan produknya — pertimbangkan sebelum mengirim foto. Bila model tidak ditemukan, ganti
            namanya sesuai daftar di AI Studio.
          </p>
        </div>
      )}
      <Button
        full
        disabled={busy || !s.enabled || !curKey}
        onClick={async () => {
          setBusy(true);
          try {
            toast(await testConnection());
          } catch (e) {
            toast(e instanceof AiError ? e.message : 'Tes gagal.');
          } finally {
            setBusy(false);
            setUsage(await usageThisMonth());
          }
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Tes koneksi
      </Button>
      {usage && (
        <p className="text-xs text-muted">
          Bulan ini: {usage.calls} panggilan · {usage.tokens.toLocaleString('id-ID')} token{usage.usd > 0 ? ` · ±US$${fmt2(usage.usd)} (perkiraan, Claude)` : ''}.
        </p>
      )}
    </Section>
  );
}

function IntegrationsCard() {
  const toast = useToast();
  const [st, setSt] = useState<HcStatus | null>(null);
  const [auto, setAuto] = useState(false);
  const [write, setWrite] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setSt(await getHealthConnectStatus());
    setAuto(await getMeta('hcAutoSync', false));
    setWrite(await getMeta('hcWriteEnabled', false));
    setLast(await lastHealthConnectSync());
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <Section title="Jam tangan & Health Connect" icon={<Watch className="h-5 w-5" />} summary={!st ? '…' : !st.supported ? 'Hanya di aplikasi Android' : st.available ? `${st.readGranted.length} izin baca` : 'Belum tersedia'}>
      <div className="space-y-2 text-sm">
        <p className="font-medium">Huawei Band → aplikasi ini</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Pastikan Band tersinkron ke aplikasi <b>Huawei Health</b>.</li>
          <li>Pasang <b>Health Sync</b> (Play Store), pilih sumber Huawei Health dan tujuan Health Connect. Pakai trial 1 minggu untuk memastikan data tidur & nadi Band-mu ikut terbawa.</li>
          <li>Di sini: tekan "Izinkan Health Connect", lalu aktifkan sinkron otomatis.</li>
        </ol>
        <p className="text-xs text-muted">Huawei Health belum punya sinkron resmi ke Health Connect, jadi Health Sync (aplikasi pihak ketiga) dibutuhkan. Data yang tidak terbawa bisa diisi lewat "Screenshot jam" di Catat.</p>
      </div>
      {st && !st.supported && <Note tone="info">Kamu sedang memakai versi web. Health Connect hanya tersedia di aplikasi Android (APK).</Note>}
      {st?.supported && !st.available && <Note tone="caution">Health Connect belum tersedia: {st.reason}. Di Android 13 ke bawah, pasang "Health Connect" dari Play Store.</Note>}
      {st?.supported && (
        <div className="space-y-2">
          <Button
            full
            variant="primary"
            onClick={async () => {
              try {
                setSt(await requestHealthConnect(write));
              } catch (e) {
                toast(`Gagal meminta izin: ${(e as Error).message}`);
              }
            }}
          >
            Izinkan Health Connect
          </Button>
          {st.available && (
            <>
              <p className="text-xs text-muted">Izin baca: {st.readGranted.join(', ') || 'belum ada'} · tulis: {st.writeGranted.join(', ') || 'belum ada'}</p>
              <Toggle
                label="Sinkron otomatis saat aplikasi dibuka"
                checked={auto}
                onChange={async (v) => {
                  setAuto(v);
                  await setMeta('hcAutoSync', v);
                }}
              />
              <Toggle
                label="Tulis berat & kalori ke Health Connect"
                hint="Agar terlihat di aplikasi kesehatan lain"
                checked={write}
                onChange={async (v) => {
                  setWrite(v);
                  await setMeta('hcWriteEnabled', v);
                  if (v) setSt(await requestHealthConnect(true));
                }}
              />
              <Button
                full
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await syncFromHealthConnect(todayKey(), 14);
                  setBusy(false);
                  setLast(await lastHealthConnectSync());
                  toast(r.error ? `Gagal: ${r.error}` : `${r.changedDays} hari diperbarui${r.skippedManual ? ` (${r.skippedManual} isian manual tidak ditimpa)` : ''}`);
                }}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sinkron 14 hari terakhir
              </Button>
              <Button full variant="ghost" onClick={() => void openHealthConnectSettings()}>
                <ExternalLink className="h-4 w-4" /> Buka pengaturan Health Connect
              </Button>
              {last && <p className="text-xs text-muted">Sinkron terakhir: {new Date(last).toLocaleString('id-ID')}</p>}
            </>
          )}
        </div>
      )}
    </Section>
  );
}

function RemindersCard() {
  const toast = useToast();
  const [r, setR] = useState<ReminderPrefs | null>(null);
  useEffect(() => {
    void getReminderPrefs().then(setR);
  }, []);
  if (!r) return null;
  const upd = async (next: ReminderPrefs) => {
    setR(next);
    const ok = await applyReminders(next);
    if (!ok) toast('Izin notifikasi ditolak. Aktifkan di pengaturan Android.');
  };
  const anyOn = r.morningCheckin.on || r.eveningCheckin.on || r.bedtime.on || r.weeklyBackup.on;
  return (
    <Section title="Pengingat" icon={<Bell className="h-5 w-5" />} summary={anyOn ? 'Ada yang aktif' : 'Semua mati (opt-in)'}>
      {!isNative() && <Note tone="info">Pengingat yang tetap muncul saat aplikasi ditutup hanya tersedia di aplikasi Android.</Note>}
      <ReminderRow label="Catat pagi (berat & tidur)" v={r.morningCheckin} onChange={(v) => void upd({ ...r, morningCheckin: v })} />
      <ReminderRow label="Catat malam (makan, langkah, GERD)" v={r.eveningCheckin} onChange={(v) => void upd({ ...r, eveningCheckin: v })} />
      <ReminderRow label="Siap-siap tidur" v={r.bedtime} onChange={(v) => void upd({ ...r, bedtime: v })} />
      <ReminderRow label="Backup mingguan (Minggu)" v={r.weeklyBackup} onChange={(v) => void upd({ ...r, weeklyBackup: { ...r.weeklyBackup, ...v } })} />
    </Section>
  );
}

function ReminderRow({ label, v, onChange }: { label: string; v: { on: boolean; time: string }; onChange: (v: { on: boolean; time: string }) => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-field p-3">
      <Toggle label={label} checked={v.on} onChange={(on) => onChange({ ...v, on })} />
      {v.on && <TimeField label="Jam" value={v.time} onChange={(t) => t && onChange({ ...v, time: t })} />}
    </div>
  );
}

function DataCard() {
  const toast = useToast();
  const [persist, setPersist] = useState<boolean | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ data: BackupFile; info: ImportPreview } | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [csvSep, setCsvSep] = useState<';' | ','>(';');
  useEffect(() => {
    void isStoragePersistent().then(setPersist);
    void getMeta<string | null>('lastBackupAt', null).then(setLastBackup);
  }, []);
  const stale = !lastBackup || Date.now() - new Date(lastBackup).getTime() > 7 * 86_400_000;

  async function exportJson() {
    const b = await exportAll();
    const r = await shareOrDownload(backupFileName('backup', 'json'), backupJson(b), 'application/json', 'Backup Jejak Sehat');
    if (r !== 'cancelled') {
      const now = new Date().toISOString();
      await setMeta('lastBackupAt', now);
      setLastBackup(now);
      toast(r === 'shared' ? 'Backup siap dibagikan' : 'Backup diunduh');
    }
  }

  async function exportCsv(kind: 'harian' | 'makanan' | 'gerd') {
    const b = await exportAll();
    const content = kind === 'harian' ? dailyCsv(b.days, csvSep) : kind === 'makanan' ? mealsCsv(b.days, csvSep) : gerdCsv(b.days, csvSep);
    await shareOrDownload(backupFileName(kind, 'csv'), content, 'text/csv;charset=utf-8', `CSV ${kind}`);
  }

  function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setImportErr(null);
      if (f.size > 50 * 1024 * 1024) return setImportErr('File terlalu besar.');
      const parsed = parseBackup(await f.text());
      if (!parsed.ok) return setImportErr(parsed.error);
      setPreview({ data: parsed.data, info: await previewImport(parsed.data) });
    };
    input.click();
  }

  return (
    <Section title="Data: backup, impor, hapus" icon={<Download className="h-5 w-5" />} summary={lastBackup ? `Backup terakhir ${formatMedium(lastBackup.slice(0, 10))}` : 'Belum pernah backup'}>
      <Note tone={stale ? 'caution' : 'info'}>
        Data hanya ada di perangkat ini. Menghapus aplikasi/data aplikasi (atau data situs di browser) akan menghapus catatanmu. Simpan backup berkala, mis. ke Google Drive.
      </Note>
      <p className="text-xs text-muted">
        Penyimpanan permanen: {persist == null ? 'tidak diketahui' : persist ? <Badge tone="accent">aktif</Badge> : <Badge tone="caution">belum</Badge>}
        {persist === false && (
          <Button variant="ghost" onClick={async () => setPersist(await requestPersistentStorage())}>
            Minta penyimpanan permanen
          </Button>
        )}
      </p>
      <Button full variant="primary" onClick={() => void exportJson()}>
        <Download className="h-4 w-4" /> {isAndroid() ? 'Backup JSON (bagikan ke Drive/WA)' : 'Unduh backup JSON'}
      </Button>
      <Segmented
        label="Format CSV"
        options={[
          { id: ';', label: 'Excel Indonesia (;)' },
          { id: ',', label: 'Standar (,)' },
        ]}
        value={csvSep}
        allowClear={false}
        onChange={(v) => v && setCsvSep(v)}
      />
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => void exportCsv('harian')}>CSV harian</Button>
        <Button onClick={() => void exportCsv('makanan')}>CSV makanan</Button>
        <Button onClick={() => void exportCsv('gerd')}>CSV GERD</Button>
      </div>
      <Button full onClick={pickFile}>
        <Upload className="h-4 w-4" /> Impor backup JSON
      </Button>
      {importErr && <Note tone="caution" title="Impor ditolak">{importErr} Data yang ada tidak diubah.</Note>}
      <Button full variant="danger" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" /> Hapus semua data
      </Button>

      <ConfirmDialog
        open={!!preview}
        title="Pratinjau impor"
        body={
          preview && (
            <div className="space-y-3 text-sm">
              <ul className="space-y-1">
                <li>{preview.info.days} hari catatan{preview.info.firstDate ? ` (${preview.info.firstDate} s.d. ${preview.info.lastDate})` : ''}</li>
                <li>{preview.info.conflicts} tanggal sudah ada di perangkat ini</li>
                <li>Profil: {preview.info.hasProfile ? 'ada' : 'tidak ada'} · favorit {preview.info.favorites} · lab {preview.info.labResults} · pertanyaan dokter {preview.info.clinicianNotes}</li>
              </ul>
              <Segmented
                label="Cara impor"
                options={[
                  { id: 'merge', label: 'Gabung (backup menang bila tanggal sama)' },
                  { id: 'replace', label: 'Ganti semua data' },
                ]}
                value={mode}
                allowClear={false}
                onChange={(v) => v && setMode(v)}
              />
              {mode === 'replace' && <Note tone="caution">Semua data di perangkat ini akan diganti isi backup.</Note>}
            </div>
          )
        }
        confirmLabel="Impor sekarang"
        danger={mode === 'replace'}
        onCancel={() => setPreview(null)}
        onConfirm={async () => {
          if (!preview) return;
          await applyImport(preview.data, mode);
          setPreview(null);
          toast('Impor selesai');
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Hapus semua data?"
        body="Semua catatan, profil, favorit, hasil lab, dan pengaturan di perangkat ini akan dihapus permanen. Buat backup dulu bila perlu."
        confirmLabel="Hapus semuanya"
        danger
        requireText="HAPUS"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteAllData();
          setConfirmDelete(false);
          window.location.hash = '#/beranda';
        }}
      />
    </Section>
  );
}
