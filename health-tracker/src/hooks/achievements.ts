import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setMeta } from '../db/db';
import type { DailyEntry, UserProfile } from '../domain/types';
import { evaluateAchievements, ACHIEVEMENTS } from '../domain/engagement';
import { todayKey } from '../lib/date';
import { useToast } from '../components/ui';

/** Evaluates achievements, persists newly earned ones (permanent) and celebrates them once. */
export function useAchievements(days: DailyEntry[] | undefined, profile: UserProfile) {
  const toast = useToast();
  const earned = useLiveQuery(async () => ((await db.meta.get('achievements'))?.value as Record<string, string> | undefined) ?? {}, []);
  const [today] = useState(todayKey);
  const result = useMemo(() => (days && earned ? evaluateAchievements(days, profile, today, earned) : null), [days, earned, profile, today]);
  useEffect(() => {
    if (!result || !earned || result.newly.length === 0) return;
    const next = { ...earned };
    result.newly.forEach((id) => (next[id] = today));
    void setMeta('achievements', next);
    const names = result.newly.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title).filter(Boolean);
    toast(names.length === 1 ? `🏆 Pencapaian baru: ${names[0]}` : `🏆 ${names.length} pencapaian baru: ${names.slice(0, 2).join(', ')}${names.length > 2 ? '…' : ''}`);
  }, [result, earned, today, toast]);
  return result?.list ?? null;
}
