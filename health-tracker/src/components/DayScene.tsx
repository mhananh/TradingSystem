import type { DayPart } from '../domain/today';

/**
 * Flat, hand-composed landscape that follows the time of day (sun → moon).
 * Purely decorative: the message next to it carries the meaning.
 */
const SKY: Record<DayPart, [string, string]> = {
  pagi: ['#f8dcc4', '#f4efe6'],
  siang: ['#dce8e6', '#f4efe6'],
  sore: ['#f3cfb3', '#f4e3d3'],
  malam: ['#2f3e57', '#46566f'],
};

export function DayScene({ part, className }: { part: DayPart; className?: string }) {
  const [top, bottom] = SKY[part];
  const night = part === 'malam';
  const orb = { pagi: { x: 70, y: 70 }, siang: { x: 170, y: 40 }, sore: { x: 262, y: 74 }, malam: { x: 250, y: 46 } }[part];
  return (
    <svg viewBox="0 0 320 150" className={className} role="presentation" aria-hidden preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`sky-${part}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="320" height="150" fill={`url(#sky-${part})`} />
      {night ? (
        <>
          <circle cx={orb.x} cy={orb.y} r="16" fill="#f4e9cf" />
          <circle cx={orb.x + 7} cy={orb.y - 5} r="14" fill={top} />
          {[[40, 30], [92, 52], [140, 24], [196, 40], [286, 22], [300, 60]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#f4e9cf" opacity="0.8" />
          ))}
        </>
      ) : (
        <circle cx={orb.x} cy={orb.y} r="20" fill={part === 'siang' ? '#f2c66d' : '#e9935f'} />
      )}
      <path d="M0 108 C 50 86, 96 92, 140 104 S 240 84, 320 98 L320 150 L0 150 Z" fill={night ? '#3b5150' : '#a9c3a6'} />
      <path d="M0 124 C 60 108, 120 116, 170 126 S 270 110, 320 120 L320 150 L0 150 Z" fill={night ? '#2c403d' : '#7fa585'} />
      <path d="M0 140 C 80 130, 160 136, 220 142 S 300 134, 320 138 L320 150 L0 150 Z" fill={night ? '#22332f' : '#5c8a68'} />
      <path d="M196 150 C 200 140, 214 132, 236 126" stroke={night ? '#56706a' : '#e9dcc4'} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
