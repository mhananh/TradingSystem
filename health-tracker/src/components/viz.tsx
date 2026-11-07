import type { ReactNode } from 'react';
import { Scale, Flame, Egg, Moon, Footprints, HeartPulse, Droplets, Zap, Dumbbell, Sparkles, CalendarCheck, Camera, Leaf, Flag, Trophy, Lock } from 'lucide-react';
import { cx } from './ui';
import type { CalendarCell, AchievementState } from '../domain/engagement';
import { addDays, formatShort, parseDateKey, todayKey, weekStart } from '../lib/date';

export type Metric = 'weight' | 'kcal' | 'protein' | 'sleep' | 'steps' | 'gerd' | 'water' | 'energy' | 'strength';

export const METRIC: Record<Metric, { color: string; label: string; Icon: typeof Scale }> = {
  weight: { color: 'var(--color-m-weight)', label: 'Berat', Icon: Scale },
  kcal: { color: 'var(--color-m-kcal)', label: 'Kalori', Icon: Flame },
  protein: { color: 'var(--color-m-protein)', label: 'Protein', Icon: Egg },
  sleep: { color: 'var(--color-m-sleep)', label: 'Tidur', Icon: Moon },
  steps: { color: 'var(--color-m-steps)', label: 'Langkah', Icon: Footprints },
  gerd: { color: 'var(--color-m-gerd)', label: 'GERD', Icon: HeartPulse },
  water: { color: 'var(--color-m-water)', label: 'Air', Icon: Droplets },
  energy: { color: 'var(--color-m-energy)', label: 'Energi', Icon: Zap },
  strength: { color: 'var(--color-m-protein)', label: 'Latihan', Icon: Dumbbell },
};

export function MetricIcon({ metric, size = 'md' }: { metric: Metric; size?: 'sm' | 'md' | 'lg' }) {
  const { color, Icon } = METRIC[metric];
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const ic = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4.5 w-4.5';
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-xl', box)} style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }} aria-hidden>
      <Icon className={ic} strokeWidth={2.2} />
    </span>
  );
}

export interface RingSpec {
  metric: Metric;
  value: number;
  goal: number;
}

/** Concentric progress rings (outer → inner). Values over goal are capped visually at 100%. */
export function Rings({ rings, size = 156, stroke = 12, center }: { rings: RingSpec[]; size?: number; stroke?: number; center?: ReactNode }) {
  const gap = 3;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {rings.map((r, i) => {
          const rad = size / 2 - stroke / 2 - i * (stroke + gap);
          const len = 2 * Math.PI * rad;
          const pct = r.goal > 0 ? Math.max(0, Math.min(1, r.value / r.goal)) : 0;
          const color = METRIC[r.metric].color;
          return (
            <g key={r.metric}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={rad}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - pct)}
                className="ring-anim"
                style={{ ['--ring-len' as string]: `${len}`, filter: pct >= 1 ? `drop-shadow(0 0 6px ${color})` : undefined }}
              />
            </g>
          );
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}

/** Tiny trend line; null values create gaps (never interpolated). */
export function Sparkline({ values, color, width = 96, height = 32, dot = true }: { values: (number | null)[]; color: string; width?: number; height?: number; dot?: boolean }) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return <div style={{ width, height }} />;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const x = (i: number) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 4) + 2);
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const segs: string[] = [];
  let cur = '';
  values.forEach((v, i) => {
    if (v == null) {
      if (cur) segs.push(cur);
      cur = '';
    } else cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const lastIdx = values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop()!;
  const gid = `sg-${color.replace(/[^a-z]/gi, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {dot && <circle cx={x(lastIdx)} cy={y(values[lastIdx]!)} r={3} fill={color} />}
    </svg>
  );
}

export function DeltaChip({ value, unit, goodWhen = 'down', digits = 1 }: { value: number | null | undefined; unit: string; goodWhen?: 'down' | 'up' | 'none'; digits?: number }) {
  if (value == null || !Number.isFinite(value)) return null;
  const good = goodWhen === 'none' ? null : goodWhen === 'down' ? value < 0 : value > 0;
  const flat = Math.abs(value) < Math.pow(10, -digits);
  const txt = `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits).replace('.', ',')} ${unit}`;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular',
        flat || good == null ? 'bg-soft text-muted' : good ? 'bg-accent-soft text-accent' : 'bg-soft text-ink',
      )}
    >
      {txt}
    </span>
  );
}

export function MetricTile({ metric, label, value, unit, sub, spark, href, progress }: { metric: Metric; label?: string; value: ReactNode; unit?: string; sub?: ReactNode; spark?: (number | null)[]; href?: string; progress?: number }) {
  const Comp = href ? 'a' : 'div';
  const color = METRIC[metric].color;
  return (
    <Comp href={href} className="rise block rounded-3xl border border-line bg-card p-3.5 active:bg-elev">
      <div className="flex items-center gap-2">
        <MetricIcon metric={metric} size="sm" />
        <span className="text-xs font-medium text-muted">{label ?? METRIC[metric].label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[26px] font-semibold leading-none tracking-tight tabular">
          {value}
          {unit && <span className="ml-1 text-xs font-medium text-muted">{unit}</span>}
        </p>
        {spark && <Sparkline values={spark} color={color} width={64} height={26} />}
      </div>
      {progress != null && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, background: color }} />
        </div>
      )}
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </Comp>
  );
}

const DOW = ['Sen', '', 'Rab', '', 'Jum', '', 'Min'];

/** GitHub-style consistency heatmap. Intensity = how many areas were logged; no streak counting. */
export function ConsistencyCalendar({ grid }: { grid: CalendarCell[][] }) {
  const shade = (s: number) => (s === 0 ? 'var(--color-soft)' : `color-mix(in srgb, var(--color-accent) ${20 + s * 16}%, var(--color-soft))`);
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label="Kalender konsistensi: warna lebih terang berarti lebih banyak hal tercatat hari itu">
        <div className="mr-1 grid grid-rows-7 gap-1 text-[9px] leading-none text-muted">
          {DOW.map((d, i) => (
            <span key={i} className="flex h-[14px] items-center">
              {d}
            </span>
          ))}
        </div>
        {grid.map((week, w) => (
          <div key={w} className="grid flex-1 grid-rows-7 gap-1">
            {week.map((c) => (
              <span
                key={c.date}
                title={`${formatShort(c.date)}: ${c.score}/5 area tercatat`}
                className={cx('h-[14px] rounded-[4px]', c.date === todayKey() && 'ring-1 ring-ink/60')}
                style={{ background: c.future ? 'transparent' : shade(c.score) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        sedikit
        {[0, 1, 3, 5].map((s) => (
          <span key={s} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: shade(s) }} />
        ))}
        lengkap
      </div>
    </div>
  );
}

const ACH_ICON = { spark: Sparkles, calendar: CalendarCheck, scale: Scale, moon: Moon, dumbbell: Dumbbell, egg: Egg, walk: Footprints, camera: Camera, leaf: Leaf, flag: Flag, trophy: Trophy } as const;

export function AchievementBadge({ s, compact }: { s: AchievementState; compact?: boolean }) {
  const Icon = ACH_ICON[s.a.icon];
  const earned = !!s.earnedAt;
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border p-3', earned ? 'border-accent/30 bg-accent-soft/40' : 'border-line bg-field')}>
      <span
        className={cx('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', earned ? 'pop' : '')}
        style={{
          background: earned ? 'linear-gradient(135deg, var(--color-accent), var(--color-m-steps))' : 'var(--color-soft)',
          color: earned ? 'var(--color-on-accent)' : 'var(--color-muted)',
          boxShadow: earned ? '0 6px 18px -6px var(--color-accent)' : undefined,
        }}
      >
        {earned ? <Icon className="h-5 w-5" strokeWidth={2.4} /> : <Lock className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-semibold', !earned && 'text-muted')}>{s.a.title}</p>
        {!compact && <p className="text-xs text-muted">{earned ? `Diraih ${formatShort(s.earnedAt!)}` : s.a.detail}</p>}
        {!earned && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.round(s.progress * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Mon–Sun strip for picking a date in the current week, with a dot on logged days. */
export function WeekStrip({ date, logged, onPick, maxDate }: { date: string; logged: (d: string) => boolean; onPick: (d: string) => void; maxDate: string }) {
  const start = weekStart(date);
  const names = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {names.map((n, i) => {
        const d = addDays(start, i);
        const active = d === date;
        const future = d > maxDate;
        return (
          <button
            key={d}
            type="button"
            disabled={future}
            aria-pressed={active}
            aria-label={`${n} ${formatShort(d)}${logged(d) ? ', tercatat' : ''}`}
            onClick={() => onPick(d)}
            className={cx(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs transition-colors',
              active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink',
              future && 'opacity-30',
            )}
          >
            <span className={cx('text-[10px]', active ? 'text-on-accent/80' : 'text-muted')}>{n}</span>
            <span className="text-base font-semibold tabular">{parseDateKey(d).getDate()}</span>
            <span className={cx('h-1 w-1 rounded-full', logged(d) ? (active ? 'bg-on-accent' : 'bg-accent') : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}
