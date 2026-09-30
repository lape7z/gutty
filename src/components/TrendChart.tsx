import { useMemo, useRef, useState } from 'react';
import { addDays, formatLong, formatShort } from '../date';
import { formatScore } from '../hooks';

export interface TrendPoint {
  date: string;
  value: number | undefined;
  detail?: string;
}

const W = 400;
const H = 170;
const PAD = { top: 10, right: 14, bottom: 24, left: 24 };

/** Andamento giornaliero del punteggio (0-10), con buchi dove mancano registrazioni. */
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
  const x = (i: number) => PAD.left + (days === 1 ? innerW / 2 : (i / (days - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / 10) * innerH;

  // Segmenti continui: la linea si interrompe sui giorni non registrati.
  const path = series
    .map((p, i) => {
      if (p.value === undefined) return '';
      const prevMissing = i === 0 || series[i - 1].value === undefined;
      return `${prevMissing ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
    })
    .join('');

  const tickEvery = days <= 14 ? 2 : days <= 31 ? 7 : 14;
  const ticks = series.map((p, i) => ({ p, i })).filter(({ i }) => (days - 1 - i) % tickEvery === 0);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (days - 1));
    setHover(Math.max(0, Math.min(days - 1, i)));
  };

  const hp = hover !== null ? series[hover] : null;
  const leftPct = hover !== null ? (x(hover) / W) * 100 : 0;

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Andamento dei sintomi negli ultimi ${days} giorni`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">
              {v}
            </text>
          </g>
        ))}
        {ticks.map(({ p, i }) => (
          <text key={p.date} x={x(i)} y={H - 6} textAnchor={i === days - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--text-3)">
            {formatShort(p.date)}
          </text>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--text-3)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        <path d={path} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {series.map((p, i) =>
          p.value === undefined ? null : (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 4.5 : days > 45 ? 2 : 3}
              fill="var(--series)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ),
        )}
      </svg>
      {hp && (
        <div
          className="tooltip"
          style={{
            left: `${leftPct}%`,
            transform: `translateX(${leftPct > 60 ? 'calc(-100% - 12px)' : '12px'})`,
          }}
        >
          <strong>{formatLong(hp.date)}</strong>
          <div>{hp.value === undefined ? 'Non registrato' : `Sintomi: ${formatScore(hp.value)} / 10`}</div>
          {hp.detail && <div className="muted">{hp.detail}</div>}
        </div>
      )}
    </div>
  );
}

