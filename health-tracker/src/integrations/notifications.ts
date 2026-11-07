// Opt-in local reminders (Android). They fire even when the app is closed. Copy is neutral — no guilt.
import { isNative } from '../lib/platform';
import { getMeta, setMeta } from '../db/db';

export interface ReminderPrefs {
  morningCheckin: { on: boolean; time: string };
  eveningCheckin: { on: boolean; time: string };
  bedtime: { on: boolean; time: string };
  weeklyBackup: { on: boolean; weekday: number; time: string }; // 1 = Sunday … 7 = Saturday
}

export const DEFAULT_REMINDERS: ReminderPrefs = {
  morningCheckin: { on: false, time: '07:00' },
  eveningCheckin: { on: false, time: '20:30' },
  bedtime: { on: false, time: '22:00' },
  weeklyBackup: { on: false, weekday: 1, time: '19:00' },
};

const IDS = { morningCheckin: 101, eveningCheckin: 102, bedtime: 103, weeklyBackup: 104 } as const;

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  return { ...DEFAULT_REMINDERS, ...(await getMeta<Partial<ReminderPrefs>>('reminders', {})) };
}

export async function notificationsSupported() {
  return isNative();
}

/** Save prefs and (re)schedule. Returns false if permission was denied. */
export async function applyReminders(prefs: ReminderPrefs): Promise<boolean> {
  await setMeta('reminders', prefs);
  if (!isNative()) return true;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: Object.values(IDS).map((id) => ({ id })) }).catch(() => undefined);
  const anyOn = prefs.morningCheckin.on || prefs.eveningCheckin.on || prefs.bedtime.on || prefs.weeklyBackup.on;
  if (!anyOn) return true;
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  const hm = (t: string) => t.split(':').map(Number) as [number, number];
  const list = [] as Parameters<typeof LocalNotifications.schedule>[0]['notifications'];
  if (prefs.morningCheckin.on) {
    const [hour, minute] = hm(prefs.morningCheckin.time);
    list.push({ id: IDS.morningCheckin, title: 'Catat pagi', body: 'Berat & tidur semalam — cukup 30 detik.', schedule: { on: { hour, minute }, allowWhileIdle: true } });
  }
  if (prefs.eveningCheckin.on) {
    const [hour, minute] = hm(prefs.eveningCheckin.time);
    list.push({ id: IDS.eveningCheckin, title: 'Catat hari ini', body: 'Makan, langkah, dan GERD hari ini. Tidak harus lengkap.', schedule: { on: { hour, minute }, allowWhileIdle: true } });
  }
  if (prefs.bedtime.on) {
    const [hour, minute] = hm(prefs.bedtime.time);
    list.push({ id: IDS.bedtime, title: 'Siap-siap tidur', body: 'Kesempatan tidur 7–9 jam membantu energi & kantuk siang.', schedule: { on: { hour, minute }, allowWhileIdle: true } });
  }
  if (prefs.weeklyBackup.on) {
    const [hour, minute] = hm(prefs.weeklyBackup.time);
    list.push({ id: IDS.weeklyBackup, title: 'Backup mingguan', body: 'Simpan backup data ke Drive/WhatsApp agar aman.', schedule: { on: { weekday: prefs.weeklyBackup.weekday, hour, minute }, allowWhileIdle: true } });
  }
  await LocalNotifications.schedule({ notifications: list });
  return true;
}
