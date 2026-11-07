import { Suspense, lazy, useEffect, useState } from 'react';
import { Sun, PenLine, LineChart, HeartPulse, WifiOff } from 'lucide-react';
import { useProfile } from './hooks/data';
import { cx, useOnline } from './components/ui';
import { todayKey, isDateKey } from './lib/date';
import { requestPersistentStorage } from './lib/platform';
import Beranda from './pages/Beranda';
import { getMeta } from './db/db';
import { syncFromHealthConnect } from './integrations/healthConnect';

// Heavy screens are split out so the app opens fast (charts only load on "Tren").
const Catat = lazy(() => import('./pages/Catat'));
const Progres = lazy(() => import('./pages/Progres'));
const Kesehatan = lazy(() => import('./pages/Kesehatan'));
const Pengaturan = lazy(() => import('./pages/Pengaturan'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

export type Tab = 'beranda' | 'catat' | 'progres' | 'kesehatan' | 'pengaturan';

export interface Route {
  tab: Tab;
  date?: string;
  sub?: string;
}

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  const tab = (['beranda', 'catat', 'progres', 'kesehatan', 'pengaturan'] as Tab[]).includes(parts[0] as Tab) ? (parts[0] as Tab) : 'beranda';
  const date = isDateKey(parts[1]) ? parts[1] : undefined;
  const sub = !date && parts[1] ? parts[1] : undefined;
  return { tab, date, sub };
}

export function go(r: Route) {
  const h = `#/${r.tab}${r.date ? `/${r.date}` : r.sub ? `/${r.sub}` : ''}`;
  if (window.location.hash !== h) window.location.hash = h;
}

const NAV: { tab: Tab; label: string; Icon: typeof Sun }[] = [
  { tab: 'beranda', label: 'Hari ini', Icon: Sun },
  { tab: 'catat', label: 'Catat', Icon: PenLine },
  { tab: 'progres', label: 'Tren', Icon: LineChart },
  { tab: 'kesehatan', label: 'Kesehatan', Icon: HeartPulse },
];

function Loading() {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">Memuat…</div>;
}

export default function App() {
  const profile = useProfile();
  const [route, setRoute] = useState<Route>(parseHash);
  const online = useOnline();

  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    if (!profile?.onboardingCompletedAt) return;
    (async () => {
      if (await getMeta<boolean>('hcAutoSync', false)) await syncFromHealthConnect(todayKey(), 3).catch(() => undefined);
    })();
  }, [profile?.onboardingCompletedAt]);

  if (profile === undefined) return <Loading />;
  if (!profile || !profile.onboardingCompletedAt)
    return (
      <Suspense fallback={<Loading />}>
        <Onboarding existing={profile} />
      </Suspense>
    );

  const activeTab = route.tab === 'pengaturan' ? 'kesehatan' : route.tab;
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {!online && (
        <div className="pt-safe sticky top-0 z-40 flex items-center justify-center gap-2 bg-caution-soft py-1.5 text-xs text-caution" role="status">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> Offline — pencatatan tetap berjalan, fitur AI butuh internet.
        </div>
      )}
      <main className="pt-safe flex-1 px-5 pb-28 pt-5">
        <Suspense fallback={<Loading />}>
          {route.tab === 'beranda' && <Beranda profile={profile} />}
          {route.tab === 'catat' && <Catat profile={profile} date={route.date ?? todayKey()} />}
          {route.tab === 'progres' && <Progres profile={profile} />}
          {route.tab === 'kesehatan' && <Kesehatan profile={profile} sub={route.sub} />}
          {route.tab === 'pengaturan' && <Pengaturan profile={profile} sub={route.sub} />}
        </Suspense>
      </main>
      <nav aria-label="Navigasi utama" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map(({ tab, label, Icon }) => {
            const active = activeTab === tab;
            return (
              <li key={tab}>
                <a
                  href={`#/${tab}`}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex min-h-16 flex-col items-center justify-center gap-1 text-xs', active ? 'font-semibold text-ink' : 'text-muted')}
                >
                  <Icon className="h-[22px] w-[22px]" aria-hidden strokeWidth={active ? 2.2 : 1.7} />
                  {label}
                  <span className={cx('h-1 w-1 rounded-full', active ? 'bg-m-kcal' : 'bg-transparent')} />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
