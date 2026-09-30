import { useMemo, useState } from 'react';
import { formatLong, todayISO } from '../date';
import { formatScore, overallScore, useActiveSymptoms, useDays, useFactorNames } from '../hooks';
import { TrendChart, type TrendPoint } from './TrendChart';

const RANGES = [14, 30, 90] as const;

export function DiaryView({ onOpen }: { onOpen: (date: string) => void }) {
  const days = useDays();
  const symptoms = useActiveSymptoms();
  const nameOf = useFactorNames();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const points = useMemo(() => {
    const map = new Map<string, TrendPoint>();
    for (const d of days ?? []) {
      const names = d.foods.map(nameOf);
      map.set(d.date, {
        date: d.date,
        value: overallScore(d, symptoms),
        detail: names.length ? names.slice(0, 5).join(', ') + (names.length > 5 ? ` e altri ${names.length - 5}` : '') : undefined,
      });
    }
    return map;
  }, [days, symptoms, nameOf]);

  if (!days) return <p className="muted">Caricamento…</p>;

  if (days.length === 0) {
    return (
      <div className="card">
        <h2>Il diario è vuoto</h2>
        <p className="muted">
          Registra la prima giornata dalla scheda <strong>Oggi</strong>. Se vuoi vedere come funziona l’analisi, puoi caricare
          dati di esempio da <strong>Impostazioni</strong>.
        </p>
      </div>
    );
  }

  const sorted = [...days].reverse();

  return (
    <>
      <section className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Intensità media dei sintomi</h2>
          <span className="spacer" />
          <div className="row" role="group" aria-label="Periodo">
            {RANGES.map((r) => (
              <button key={r} className="chip" aria-pressed={range === r} onClick={() => setRange(r)}>
                {r} gg
              </button>
            ))}
          </div>
        </div>
        <TrendChart points={points} end={todayISO()} days={range} />
      </section>

      <section className="card">
        <h2>Giornate registrate ({days.length})</h2>
        <ul className="day-list">
          {sorted.map((d) => {
            const score = overallScore(d, symptoms);
            return (
              <li key={d.date}>
                <button className="day-item" onClick={() => onOpen(d.date)}>
                  <span className="score-badge">
                    {formatScore(score)}
                    <small>/ 10</small>
                  </span>
                  <span>
                    <strong>{formatLong(d.date)}</strong>
                    <span className="muted small">
                      {[d.bristol && `Bristol ${d.bristol}`, d.stress && `stress ${d.stress}/5`, d.sleep && `sonno ${d.sleep}/5`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="chips" style={{ marginTop: 6 }}>
                      {d.foods.slice(0, 8).map((f) => (
                        <span key={f} className="chip static">
                          {nameOf(f)}
                        </span>
                      ))}
                      {d.foods.length > 8 && <span className="chip static">+{d.foods.length - 8}</span>}
                    </span>
                    {d.notes && <span className="muted small" style={{ display: 'block', marginTop: 4 }}>“{d.notes}”</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
