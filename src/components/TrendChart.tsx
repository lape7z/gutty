import { useMemo, useRef, useState } from 'react';
import { addDays, formatLong, formatShort } from '../date';
import { heatLevel, levelWord } from '../ui';

export interface TrendPoint {
  date: string;
  value: number | undefined;
  detail?: string;
}

const W = 400;
const H = 168;
const PAD = { top: 10, right: 6, bottom: 24, left: 56 };
const SCALE = [
  { v: 0, label: 'Bene' },
  { v: 2, label: 'Fastidio' },
  { v: 4, label: 'Malissimo' },
];

/**
 * Andamento giornaliero della media dei sintomi (0 = bene, 4 = malissimo). La linea si interrompe sui giorni non
 * registrati; i punti usano la stessa scala di colore del calendario.
 */
export function TrendChart({ points, end, days }: { points: Map<string, TrendPoint>; end: string; days: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const series = useMemo(() => {
    const start = addDays(end, -(days - 1));
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(start, i);
      return points.get(date) ?? { date, value: undefined };
    });
  }, [points, end, days]);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (days - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / 4) * innerH;

  const segments: string[] = [];
  let current = '';
  series.forEach((p, i) => {
    if (p.value === undefined) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (current) segments.push(current);

  const tickEvery = days <= 31 ? 7 : 21;
  const ticks = series.map((p, i) => ({ p, i })).filter(({ i }) => (days - 1 - i) % tickEvery === 0);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (days - 1));
    setHover(Math.max(0, Math.min(days - 1, i)));
  };

  const hp = hover !== null ? series[hover] : null;
  const leftPct = hover !== null ? (x(hover) / W) * 100 : 0;
  const logged = series.filter((p) => p.value !== undefined);

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Media dei sintomi negli ultimi ${days} giorni: ${logged.length} giorni registrati`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {SCALE.map(({ v, label }) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : '4 4'}
            />
            <text x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end" fontSize={9} fontWeight={500} fill="var(--ink-3)">
              {label}
            </text>
          </g>
        ))}
        {ticks.map(({ p, i }) => (
          <text
            key={p.date}
            x={x(i)}
            y={H - 6}
            textAnchor={i === days - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
            fontSize={9}
           
            fontWeight={500}
            fill="var(--ink-3)"
          >
            {formatShort(p.date)}
          </text>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--primary)" strokeOpacity={0.4} strokeWidth={1.5} />
        )}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--primary)" strokeOpacity={0.55} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((p, i) => {
          if (p.value === undefined) return null;
          return (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 5.5 : days > 45 ? 2.8 : 3.8}
              fill={p.value > 0 ? `var(--v-${heatLevel(p.value)})` : 'var(--better)'}
              stroke="var(--card)"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
      {hp && (
        <div
          className="tooltip"
          style={{
            left: `${leftPct}%`,
            transform: `translateX(${leftPct > 55 ? 'calc(-100% - 12px)' : '12px'})`,
          }}
        >
          <strong>{formatLong(hp.date)}</strong>
          {hp.value === undefined ? 'Non registrato' : `In media: ${levelWord(hp.value).toLowerCase()}`}
          {hp.detail && <div className="t-foods">{hp.detail}</div>}
        </div>
      )}
    </div>
  );
}
