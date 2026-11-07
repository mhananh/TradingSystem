// API keys live only on this device: Android Keystore-backed secure storage in the app,
// IndexedDB in the browser build (less protected — the UI says so). Never in code, URLs or logs.
import { isNative } from '../lib/platform';
import { db } from '../db/db';

export type AiProvider = 'claude' | 'gemini';
const keyName = (p: AiProvider) => `ai-key-${p}`;

export async function getApiKey(p: AiProvider): Promise<string | null> {
  try {
    if (isNative()) {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      const v = await SecureStorage.get(keyName(p));
      return typeof v === 'string' && v ? v : null;
    }
    const r = await db.meta.get(keyName(p));
    return typeof r?.value === 'string' && r.value ? r.value : null;
  } catch {
    return null;
  }
}

export async function setApiKey(p: AiProvider, key: string): Promise<void> {
  const v = key.trim();
  if (isNative()) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    if (v) await SecureStorage.set(keyName(p), v);
    else await SecureStorage.remove(keyName(p));
    return;
  }
  if (v) await db.meta.put({ key: keyName(p), value: v });
  else await db.meta.delete(keyName(p));
}

export function maskKey(k: string | null): string {
  if (!k) return 'belum diisi';
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}
