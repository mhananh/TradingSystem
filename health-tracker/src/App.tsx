import { useEffect, useState } from 'react';
import { Home, PenLine, LineChart, HeartPulse, Settings, WifiOff } from 'lucide-react';
import { useProfile } from './hooks/data';
import { cx, useOnline } from './components/ui';
import { todayKey, isDateKey } from './lib/date';
import { requestPersistentStorage } from './lib/platform';
import Onboarding from './pages/Onboarding';
import Beranda from './pages/Beranda';
import Catat from './pages/Catat';
import Progres from './pages/Progres';
import Kesehatan from './pages/Kesehatan';
import Pengaturan from './pages/Pengaturan';
import { getMeta } from './db/db';
import { syncFromHealthConnect } from './integrations/healthConnect';

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

const NAV: { tab: Tab; label: string; Icon: typeof Home }[] = [
  { tab: 'beranda', label: 'Beranda', Icon: Home },
  { tab: 'catat', label: 'Catat', Icon: PenLine },
  { tab: 'progres', label: 'Progres', Icon: LineChart },
  { tab: 'kesehatan', label: 'Kesehatan', Icon: HeartPulse },
  { tab: 'pengaturan', label: 'Pengaturan', Icon: Settings },
];

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

  // Auto-pull Health Connect data on launch when the user enabled it.
  useEffect(() => {
    if (!profile?.onboardingCompletedAt) return;
    (async () => {
      if (await getMeta<boolean>('hcAutoSync', false)) await syncFromHealthConnect(todayKey(), 3).catch(() => undefined);
    })();
  }, [profile?.onboardingCompletedAt]);

  if (profile === undefined) {
    return <div className="flex min-h-dvh items-center justify-center text-muted">Memuat…</div>;
  }
  if (!profile || !profile.onboardingCompletedAt) return <Onboarding existing={profile} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {!online && (
        <div className="pt-safe sticky top-0 z-40 flex items-center justify-center gap-2 bg-soft py-1.5 text-xs text-muted" role="status">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> Offline — pencatatan tetap berjalan, fitur AI butuh internet.
        </div>
      )}
      <main className="pt-safe flex-1 px-4 pb-28 pt-4">
        {route.tab === 'beranda' && <Beranda profile={profile} />}
        {route.tab === 'catat' && <Catat profile={profile} date={route.date ?? todayKey()} />}
        {route.tab === 'progres' && <Progres profile={profile} />}
        {route.tab === 'kesehatan' && <Kesehatan profile={profile} sub={route.sub} />}
        {route.tab === 'pengaturan' && <Pengaturan profile={profile} sub={route.sub} />}
      </main>
      <nav aria-label="Navigasi utama" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ tab, label, Icon }) => {
            const active = route.tab === tab;
            return (
              <li key={tab}>
                <a
                  href={`#/${tab}`}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'font-semibold text-accent' : 'text-muted')}
                >
                  <Icon className="h-6 w-6" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
