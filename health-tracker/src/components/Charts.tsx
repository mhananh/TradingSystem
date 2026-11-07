import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { daysBetween, formatShort } from '../lib/date';
import { fmt0, fmt1 } from '../lib/format';

const EPOCH = '2000-01-01';
export const dayNum = (d: string) => daysBetween(EPOCH, d);
const fromNum = (n: number) => {
  const d = new Date(2000, 0, 1);
  d.setDate(d.getDate() + n);
  return formatShort(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
};

const C = { accent: '#2f6b4f', soft: '#9cb8a9', ink: '#23211e', muted: '#8a847b', caution: '#b7791f', info: '#2d5b86', grid: '#e6e0d6' };
const axis = { fontSize: 11, fill: C.muted };

export interface WeightPoint {
  x: number;
  weight?: number;
  avg?: number | null;
}

export function WeightChart({ points, goal, projection, height = 240 }: { points: WeightPoint[]; goal?: number; projection?: { x: number; opt?: number; mid?: number; pes?: number }[]; height?: number }) {
  const all = [...points, ...(projection ?? [])];
  const vals = all.flatMap((p) => Object.entries(p).filter(([k, v]) => k !== 'x' && typeof v === 'number').map(([, v]) => v as number));
  if (goal) vals.push(goal);
  const lo = Math.floor(Math.min(...vals) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);
  return (
    <div style={{ height }} role="img" aria-label="Grafik berat badan: titik penimbangan dan garis rata-rata 7 hari">
      <ResponsiveContainer>
        <ComposedChart data={all} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fromNum} tick={axis} tickCount={5} />
          <YAxis domain={[lo, hi]} tick={axis} tickFormatter={(v) => fmt0(v)} unit="" width={44} />
          <Tooltip labelFormatter={(v) => fromNum(Number(v))} formatter={(v, name) => [`${fmt1(Number(v))} kg`, String(name)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {goal && <ReferenceLine y={goal} stroke={C.accent} strokeDasharray="4 4" label={{ value: `Target ${fmt0(goal)} kg`, fontSize: 10, fill: C.accent, position: 'insideBottomRight' }} />}
          <Line name="Timbangan harian" dataKey="weight" stroke="none" legendType="circle" dot={{ r: 3, fill: C.muted, stroke: C.muted }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          <Line name="Rata-rata 7 hari" dataKey="avg" stroke={C.accent} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          {projection && <Line name="Skenario optimis" dataKey="opt" stroke={C.info} strokeDasharray="2 4" dot={false} isAnimationActive={false} />}
          {projection && <Line name="Skenario tengah" dataKey="mid" stroke={C.ink} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
          {projection && <Line name="Skenario pesimis" dataKey="pes" stroke={C.caution} strokeDasharray="2 4" dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleLine({ data, dataKey, name, unit, height = 180, color = C.accent, domain }: { data: { x: number; [k: string]: number | null | undefined }[]; dataKey: string; name: string; unit: string; height?: number; color?: string; domain?: [number | string, number | string] }) {
  return (
    <div style={{ height }} role="img" aria-label={`Grafik ${name}`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fromNum} tick={axis} tickCount={5} />
          <YAxis tick={axis} width={44} domain={domain ?? ['auto', 'auto']} />
          <Tooltip labelFormatter={(v) => fromNum(Number(v))} formatter={(v) => [`${fmt1(Number(v))} ${unit}`, name]} />
          <Line name={name} dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily bars where incomplete days are a distinct, labelled series (not colour alone: hatched outline + legend + tooltip). */
export function NutritionBars({ data, target, unit, label, height = 200 }: { data: { x: number; complete?: number; incomplete?: number }[]; target: number; unit: string; label: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Grafik ${label} harian; hari tanpa data dibiarkan kosong`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="x" tickFormatter={fromNum} tick={axis} interval="preserveStartEnd" />
          <YAxis tick={axis} width={48} />
          <Tooltip labelFormatter={(v) => fromNum(Number(v))} formatter={(v, name) => [`${fmt0(Number(v))} ${unit}`, String(name)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={target} stroke={C.ink} strokeDasharray="4 4" label={{ value: `Target ${fmt0(target)}`, fontSize: 10, fill: C.ink, position: 'insideTopRight' }} />
          <Bar name="Hari lengkap" dataKey="complete" fill={C.accent} isAnimationActive={false} />
          <Bar name="Belum lengkap" dataKey="incomplete" fill="#ffffff" stroke={C.muted} strokeDasharray="3 2" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SleepChart({ data, targetHours, height = 220 }: { data: { x: number; sleepH?: number; sleepiness?: number }[]; targetHours: number; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Grafik durasi tidur (batang) dan kantuk setelah makan siang (garis)">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="x" tickFormatter={fromNum} tick={axis} interval="preserveStartEnd" />
          <YAxis yAxisId="h" tick={axis} width={40} domain={[0, 10]} />
          <YAxis yAxisId="s" orientation="right" tick={axis} width={28} domain={[0, 5]} />
          <Tooltip labelFormatter={(v) => fromNum(Number(v))} formatter={(v, name) => [name === 'Tidur (jam)' ? `${fmt1(Number(v))} jam` : `${fmt1(Number(v))}/5`, String(name)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId="h" y={targetHours} stroke={C.accent} strokeDasharray="4 4" />
          <Bar yAxisId="h" name="Tidur (jam)" dataKey="sleepH" fill={C.soft} isAnimationActive={false} />
          <Line yAxisId="s" name="Kantuk siang (1–5)" dataKey="sleepiness" stroke={C.caution} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyBars({ data, bars, height = 200 }: { data: { week: string; [k: string]: number | string | null }[]; bars: { key: string; name: string; color?: string; unit?: string }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Grafik mingguan: ${bars.map((b) => b.name).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="week" tick={axis} />
          <YAxis tick={axis} width={40} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {bars.map((b, i) => (
            <Bar key={b.key} name={b.name} dataKey={b.key} fill={b.color ?? [C.accent, C.caution, C.info][i % 3]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
