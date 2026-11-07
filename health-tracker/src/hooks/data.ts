import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db, saveDay } from '../db/db';
import { createEmptyDay } from '../domain/defaults';
import type { DailyEntry, UserProfile } from '../domain/types';

export function useProfile(): UserProfile | null | undefined {
  // undefined = loading, null = no profile yet
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useAllDays(): DailyEntry[] | undefined {
  return useLiveQuery(() => db.days.orderBy('date').toArray(), []);
}

export async function saveProfile(p: UserProfile) {
  await db.profile.put({ ...p, updatedAt: new Date().toISOString() });
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Editable draft of one day, autosaved (debounced) to IndexedDB.
 * One record per date: switching dates flushes pending edits first.
 */
export function useDayDraft(date: string) {
  const [draft, setDraft] = useState<DailyEntry | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const pending = useRef<DailyEntry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    try {
      setState('saving');
      await saveDay(p);
      setExists(true);
      setState('saved');
      setSavedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setDraft(null);
    setState('idle');
    db.days.get(date).then((d) => {
      if (!alive) return;
      setExists(!!d);
      setDraft(d ?? createEmptyDay(date));
    });
    return () => {
      alive = false;
      void flush();
    };
  }, [date, flush]);

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const update = useCallback(
    (patch: Partial<DailyEntry> | ((d: DailyEntry) => DailyEntry)) => {
      setDraft((cur) => {
        if (!cur) return cur;
        const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
        pending.current = next;
        setState('saving');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 600);
        return next;
      });
    },
    [flush],
  );

  const reload = useCallback(async () => {
    const d = await db.days.get(date);
    setExists(!!d);
    setDraft(d ?? createEmptyDay(date));
  }, [date]);

  return { draft, update, state, savedAt, exists, flush, reload };
}
