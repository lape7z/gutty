import { useMemo, useRef, useState } from 'react';
import { addDays, formatLong, formatShort } from '../date';
import { formatScore } from '../hooks';
import { heatLevel } from '../ui';

export interface TrendPoint {
  date: string;
  value: number | undefined;
  detail?: string;
}

const W = 400;
const H = 168;
const PAD = { top: 10, right: 6, bottom: 24, left: 22 };

/**
 * Andamento giornaliero della media dei sintomi (0-10). La linea si interrompe sui giorni non
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
  const y = (v: number) => PAD.top + innerH - (v / 10) * innerH;

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
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? 'var(--edge)' : 'var(--hair)'}
              strokeWidth={v === 0 ? 2 : 1}
              strokeDasharray={v === 0 ? undefined : '3 3'}
            />
            <text x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end" fontSize={9} fontFamily="var(--mono)" fontWeight={600} fill="var(--ink-3)">
              {v}
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
            fontFamily="var(--mono)"
            fontWeight={600}
            fill="var(--ink-3)"
          >
            {formatShort(p.date)}
          </text>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" />
        )}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        ))}
        {series.map((p, i) => {
          if (p.value === undefined) return null;
          const size = hover === i ? 10 : days > 45 ? 5 : 7;
          return (
            <rect
              key={p.date}
              x={x(i) - size / 2}
              y={y(p.value) - size / 2}
              width={size}
              height={size}
              rx={1.5}
              fill={p.value > 0 ? `var(--v-${heatLevel(p.value)})` : 'var(--card)'}
              stroke="var(--edge)"
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
          {hp.value === undefined ? 'Non registrato' : `Sintomi ${formatScore(hp.value)} su 10`}
          {hp.detail && <div className="t-foods">{hp.detail}</div>}
        </div>
      )}
    </div>
  );
}
