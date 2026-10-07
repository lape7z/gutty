import { useMemo, useRef, useState } from 'react';
import { formatLong, formatShort } from '../date';
import type { DrinkDay } from '../stats';

const W = 400;
const H = 160;
const PAD = { top: 10, right: 6, bottom: 24, left: 26 };
/** Oltre questo numero di giorni le barre diventano troppo sottili: si passa alle settimane. */
const DAILY_MAX = 120;

interface Bar {
  from: string;
  to: string;
  /** Bicchieri noti (somma, se è una settimana). */
  value: number;
  /** Giornate con alcolici di cui non si sa il numero di bicchieri. */
  unknown: number;
  logged: number;
  names: string[];
}

function toBars(series: DrinkDay[], weekly: boolean): Bar[] {
  if (!weekly) {
    return series.map((d) => ({ from: d.date, to: d.date, value: d.drinks ?? 0, unknown: d.logged && d.drinks === undefined ? 1 : 0, logged: d.logged ? 1 : 0, names: d.names }));
  }
  // Settimane che finiscono con l'ultimo giorno del periodo; la prima può essere più corta.
  const bars: Bar[] = [];
  for (let end = series.length; end > 0; end -= 7) {
    const week = series.slice(Math.max(0, end - 7), end);
    bars.unshift({
      from: week[0].date,
      to: week[week.length - 1].date,
      value: week.reduce((a, d) => a + (d.drinks ?? 0), 0),
      unknown: week.filter((d) => d.logged && d.drinks === undefined).length,
      logged: week.filter((d) => d.logged).length,
      names: [...new Set(week.flatMap((d) => d.names))],
    });
  }
  return bars;
}

function glasses(n: number): string {
  return `${n} ${n === 1 ? 'bicchiere' : 'bicchieri'}`;
}

/**
 * Bicchieri di alcol giorno per giorno (o per settimana sui periodi lunghi).
 * Giorno per giorno, da 3 bicchieri in su la barra è più scura; un cerchietto vuoto segna alcolici senza numero di bicchieri.
 */
export function DrinksChart({ series }: { series: DrinkDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const weekly = series.length > DAILY_MAX;
  const bars = useMemo(() => toBars(series, weekly), [series, weekly]);

  const n = bars.length;
  const top = Math.max(weekly ? 8 : 4, ...bars.map((b) => b.value));
  const max = Math.ceil(top / 2) * 2;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / n;
  const barW = Math.max(1, Math.min(18, slot * 0.7));
  const cx = (i: number) => PAD.left + slot * (i + 0.5);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  // Per settimana non c'è una soglia sensata: tutte le barre uguali.
  const heavy = (b: Bar) => weekly || b.value >= 3;

  const tickEvery = Math.max(1, Math.ceil(n / 5));
  const ticks = bars.map((b, i) => ({ b, i })).filter(({ i }) => (n - 1 - i) % tickEvery === 0);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor((px - PAD.left) / slot))));
  };

  const hb = hover !== null ? bars[hover] : null;
  const leftPct = hover !== null ? (cx(hover) / W) * 100 : 0;
  const total = bars.reduce((a, b) => a + b.value, 0);

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Bicchieri di alcol ${weekly ? 'per settimana' : 'giorno per giorno'}: ${total} in tutto nel periodo`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : '4 4'} />
            <text x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end" fontSize={9} fontWeight={500} fill="var(--ink-3)">
              {v}
            </text>
          </g>
        ))}
        {ticks.map(({ b, i }) => (
          <text key={b.from} x={cx(i)} y={H - 6} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={9} fontWeight={500} fill="var(--ink-3)">
            {formatShort(weekly ? b.from : b.to)}
          </text>
        ))}
        {hover !== null && <rect x={cx(hover) - slot / 2} y={PAD.top} width={slot} height={innerH} fill="var(--primary)" fillOpacity={0.08} />}
        {bars.map((b, i) => (
          <g key={b.from}>
            {b.value > 0 && (
              <rect
                x={cx(i) - barW / 2}
                y={y(b.value)}
                width={barW}
                height={innerH + PAD.top - y(b.value)}
                rx={Math.min(3, barW / 2)}
                fill="var(--primary)"
                fillOpacity={heavy(b) ? 1 : 0.45}
              />
            )}
            {b.unknown > 0 && b.value === 0 && <circle cx={cx(i)} cy={y(0) - 4} r={2.6} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />}
          </g>
        ))}
      </svg>
      {hb && (
        <div className="tooltip" style={{ left: `${leftPct}%`, transform: `translateX(${leftPct > 55 ? 'calc(-100% - 12px)' : '12px'})` }}>
          <strong>{weekly ? `${formatShort(hb.from)} – ${formatShort(hb.to)}` : formatLong(hb.from)}</strong>
          {hb.logged === 0
            ? 'Non registrato'
            : hb.value > 0
              ? glasses(hb.value)
              : hb.unknown > 0
                ? 'Alcolici senza numero di bicchieri'
                : 'Niente alcol'}
          {weekly && hb.logged > 0 && <div>{hb.logged} giornate registrate</div>}
          {weekly && hb.unknown > 0 && hb.value > 0 && <div>più {hb.unknown} con alcolici senza numero</div>}
          {hb.names.length > 0 && <div className="t-foods">{hb.names.join(', ')}</div>}
        </div>
      )}
      <div className="chart-legend" aria-hidden>
        {weekly ? (
          <span>
            <i className="sq" /> Bicchieri per settimana
          </span>
        ) : (
          <>
            <span>
              <i className="sq light" /> 1-2 bicchieri
            </span>
            <span>
              <i className="sq" /> 3 o più
            </span>
          </>
        )}
        <span>
          <i className="ring" /> Alcolici senza numero
        </span>
      </div>
    </div>
  );
}
