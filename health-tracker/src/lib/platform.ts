import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === 'android';

/** Ask the browser not to evict our IndexedDB under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (isNative()) return true; // app-private storage on Android is not evicted like browser site data
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isStoragePersistent(): Promise<boolean | null> {
  try {
    if (isNative()) return true;
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

/** Save/share a text file. Native: writes to cache then opens the Android share sheet (Drive, WhatsApp…). Web: download. */
export async function shareOrDownload(fileName: string, content: string, mime: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (isNative()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const res = await Filesystem.writeFile({ path: fileName, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title, files: [res.uri], dialogTitle: title });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** Share plain text (e.g. clinician summary) via WhatsApp/email; falls back to clipboard on web. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
