import type { FactorResult } from '../analysis';
import { signed } from '../ui';

/**
 * Barre divergenti: di quanto cambia il punteggio medio dei sintomi quando il fattore è presente.
 * A destra (rosso) = sintomi peggiori, a sinistra (blu) = sintomi migliori.
 */
export function EffectChart({ results, nameOf }: { results: FactorResult[]; nameOf: (id: string) => string }) {
  const maxAbs = Math.max(1, ...results.map((r) => Math.abs(r.diff)));
  return (
    <>
      <div className="effects">
        {results.map((r) => {
          // Massimo 40% per lato, così resta spazio per il valore accanto alla barra.
          const pct = (Math.abs(r.diff) / maxAbs) * 40;
          const worse = r.diff >= 0;
          const label = `${nameOf(r.id)}: ${signed(r.diff)} punti (${r.nExposed} giorni con, ${r.nUnexposed} senza)`;
          return (
            <div key={r.id} style={{ display: 'contents' }}>
              <div className="name" title={nameOf(r.id)}>
                {nameOf(r.id)}
              </div>
              <div className="track" title={label} aria-label={label} role="img">
                <div className={`bar ${worse ? 'worse' : 'better'}`} style={{ width: `${pct}%` }} />
                <span
                  className="val"
                  style={worse ? { left: `calc(50% + ${pct}% + 4px)` } : { right: `calc(50% + ${pct}% + 4px)` }}
                >
                  {signed(r.diff)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="effects-axis">
        <span>← sintomi migliori</span>
        <span>sintomi peggiori →</span>
      </div>
    </>
  );
}

