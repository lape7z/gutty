import { useMemo, useState } from 'react';
import { analyze, type Confidence, type LagWindow, type Target } from '../analysis';
import { useActiveSymptoms, useDays, useFactorNames } from '../hooks';
import { EffectChart, signed } from './EffectChart';

const LAGS: { key: string; label: string; lag: LagWindow }[] = [
  { key: '0', label: 'Stesso giorno', lag: { from: 0, to: 0 } },
  { key: '1', label: 'Giorno dopo', lag: { from: 1, to: 1 } },
  { key: '01', label: 'Stesso giorno o giorno dopo', lag: { from: 0, to: 1 } },
  { key: '2', label: 'Due giorni dopo', lag: { from: 2, to: 2 } },
];

const CONFIDENCE: Record<Confidence, { dots: string; label: string; help: string }> = {
  probabile: { dots: '●●●', label: 'Probabile', help: 'Differenza netta, robusta anche considerando quanti alimenti stai confrontando.' },
  'da-verificare': { dots: '●●○', label: 'Da verificare', help: 'Differenza significativa da sola, ma potrebbe essere una coincidenza tra tanti confronti.' },
  indizio: { dots: '●○○', label: 'Indizio', help: 'Una tendenza: servono più giorni per capire se è reale.' },
  nessuna: { dots: '○○○', label: 'Nessuna', help: 'Nessuna differenza distinguibile dal caso.' },
};

function num(v: number): string {
  return v.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function InsightsView() {
  const days = useDays();
  const symptoms = useActiveSymptoms();
  const nameOf = useFactorNames();
  const [targetKey, setTargetKey] = useState('overall');
  const [lagKey, setLagKey] = useState('01');
  const [showAll, setShowAll] = useState(false);

  const res = useMemo(() => {
    if (!days) return null;
    const target: Target = targetKey === 'overall' ? { kind: 'overall' } : { kind: 'symptom', id: targetKey };
    const lag = LAGS.find((l) => l.key === lagKey)!.lag;
    return analyze(days, { symptomIds: symptoms.map((s) => s.id), target, lag });
  }, [days, symptoms, targetKey, lagKey]);

  if (!days || !res) return <p className="muted">Caricamento…</p>;

  const relevant = res.results.filter((r) => r.confidence !== 'nessuna');
  const chartRows = showAll ? res.results : relevant.length ? relevant : res.results.slice(0, 8);

  return (
    <>
      <section className="card">
        <h2>Cosa analizzare</h2>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <label style={{ flex: 1 }}>
            <span className="muted small">Sintomo</span>
            <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
              <option value="overall">Tutti (media)</option>
              {symptoms.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span className="muted small">Quando compare</span>
            <select value={lagKey} onChange={(e) => setLagKey(e.target.value)}>
              {LAGS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="tiles">
        <div className="tile">
          <div className="v">{res.observations}</div>
          <div className="l">giornate analizzabili</div>
        </div>
        <div className="tile">
          <div className="v">{res.meanScore.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</div>
          <div className="l">punteggio medio / 10</div>
        </div>
        <div className="tile">
          <div className="v">{pct(res.badDayRate)}</div>
          <div className="l">giornate difficili (≥ 5)</div>
        </div>
      </div>

      {res.observations < 21 && (
        <p className="notice">
          {res.observations === 0
            ? 'Non ci sono ancora giornate analizzabili. '
            : `Hai ${res.observations} giornate analizzabili. `}
          Le correlazioni diventano affidabili dopo almeno 3–4 settimane di registrazioni costanti, e servono giornate
          consecutive per le finestre “giorno dopo”.
        </p>
      )}

      {res.results.length > 0 && (
        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Effetto sui sintomi</h2>
            <span className="spacer" />
            <button className="btn ghost small" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Solo rilevanti' : `Mostra tutti (${res.results.length})`}
            </button>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Differenza del punteggio medio (0–10) tra i giorni in cui c’è il fattore e quelli in cui non c’è.
          </p>
          <EffectChart results={chartRows} nameOf={nameOf} />

          <div className="table-wrap" style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th>Fattore</th>
                  <th title="Differenza semplice tra giorni con e senza">Diff.</th>
                  <th title="Effetto stimato al netto degli altri alimenti">Netto</th>
                  <th>Evidenza</th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {nameOf(r.id)}
                      <div className="muted small">
                        {num(r.meanExposed)} con · {num(r.meanUnexposed)} senza · {r.nExposed} gg
                        <br />
                        giornate difficili {pct(r.badRateExposed)} vs {pct(r.badRateUnexposed)}
                      </div>
                    </td>
                    <td>{signed(r.diff)}</td>
                    <td>{signed(r.netEffect)}</td>
                    <td>
                      <span className="conf" title={`${CONFIDENCE[r.confidence].help} (p = ${r.pValue.toFixed(3)})`}>
                        <span className="dots" aria-hidden>
                          {CONFIDENCE[r.confidence].dots}
                        </span>
                        {CONFIDENCE[r.confidence].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {res.insufficient.length > 0 && (
        <section className="card">
          <details>
            <summary>Dati insufficienti per {res.insufficient.length} fattori</summary>
            <p className="muted small">
              Servono almeno 3 giornate con e 3 senza il fattore. Fattori consumati troppo spesso (quasi tutti i giorni) non si
              possono confrontare: per quelli serve una pausa di qualche giorno.
            </p>
            <div className="chips">
              {res.insufficient.map((f) => (
                <span key={f.id} className="chip static">
                  {nameOf(f.id)} · {f.nExposed}
                </span>
              ))}
            </div>
          </details>
        </section>
      )}

      <section className="card">
        <h2>Come leggere i risultati</h2>
        <ul className="muted small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            <strong>Diff.</strong> confronta semplicemente i giorni con e senza. <strong>Netto</strong> stima l’effetto a parità
            degli altri alimenti: se due cose vanno spesso insieme (pizza e birra), aiuta a capire quale conta davvero.
          </li>
          <li>
            <strong>Evidenza</strong>: {Object.values(CONFIDENCE).slice(0, 3).map((c) => `${c.dots} ${c.label.toLowerCase()} — ${c.help}`).join(' ')}
          </li>
          <li>
            Correlazione non vuol dire causa. Usa i risultati come ipotesi da verificare: escludi un alimento per 2–3 settimane e
            reintroducilo, meglio se con il supporto di un gastroenterologo o di un dietista (es. protocollo low-FODMAP).
          </li>
          <li>Questa app non fornisce diagnosi. Sangue nelle feci, calo di peso o sintomi notturni vanno segnalati al medico.</li>
        </ul>
      </section>
    </>
  );
}
