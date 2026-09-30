import { useState } from 'react';

export interface BarItem {
  key: string;
  label: string;
  value: number | undefined;
  /** Testo mostrato sotto il grafico quando si tocca la barra. */
  detail: string;
}

/**
 * Colonne verticali con il valore scritto sopra: poche categorie, un solo colore (la grandezza),
 * la barra più alta in tono più scuro. Toccando una barra se ne legge il dettaglio.
 */
export function ColumnChart({
  items,
  max,
  format,
  label,
  caption,
}: {
  items: BarItem[];
  max: number;
  format: (v: number) => string;
  label: string;
  /** Etichette agli estremi dell'asse, es. ["calmo", "stressato"]. */
  caption?: [string, string];
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = items.map((it) => it.value).filter((v): v is number => v !== undefined);
  const top = values.length ? Math.max(...values) : undefined;

  return (
    <div className="columns-chart">
      <div className="columns" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }} role="group" aria-label={label}>
        {items.map((it, i) => {
          // Massimo 80% dell'altezza: sopra resta lo spazio per il valore.
          const h = it.value === undefined ? 0 : Math.max(3, (it.value / max) * 80);
          const isTop = it.value !== undefined && it.value === top && it.value > 0;
          return (
            <button
              key={it.key}
              className={`col${active === i ? ' active' : ''}${it.value === undefined ? ' empty' : ''}`}
              aria-pressed={active === i}
              aria-label={it.detail}
              onClick={() => setActive(active === i ? null : i)}
            >
              <span className="track">
                <span className="val">{it.value === undefined ? '–' : format(it.value)}</span>
                <span className={`fill${isTop ? ' top' : ''}`} style={{ height: `${h}%` }} />
              </span>
              <span className="lbl">{it.label}</span>
            </button>
          );
        })}
      </div>
      {caption && (
        <div className="twin-caption" aria-hidden>
          <span>{caption[0]}</span>
          <span>{caption[1]}</span>
        </div>
      )}
      <p className="chart-detail" aria-live="polite">
        {active === null ? '' : items[active].detail}
      </p>
    </div>
  );
}

/** Barre orizzontali con etichetta e percentuale: per classifiche (es. sintomi più frequenti). */
export function RowChart({ rows }: { rows: { key: string; label: string; share: number; detail: string }[] }) {
  const top = Math.max(0.0001, ...rows.map((r) => r.share));
  return (
    <ul className="rows-chart">
      {rows.map((r) => (
        <li key={r.key} title={r.detail} aria-label={r.detail}>
          <span className="lbl">{r.label}</span>
          <span className="track" aria-hidden>
            <span className={`fill${r.share === top ? ' top' : ''}`} style={{ width: `${(r.share / top) * 100}%` }} />
          </span>
          <span className="val">{Math.round(r.share * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
