import { useMemo, useState } from 'react';
import { analyze, type FactorResult, type LagWindow, type Target } from '../analysis';
import { LIFESTYLE_FACTORS } from '../defaults';
import { useActiveSymptoms, useDays, useFactorNames } from '../hooks';
import { EVIDENCE, Evidence, Sec, num, signed } from '../ui';
import { EffectChart } from './EffectChart';

type LagKey = '24h' | '0' | '1' | '01' | '2';

const LAGS: { key: LagKey; label: string; lag: LagWindow }[] = [
  { key: '24h', label: 'Nelle 24 ore dopo', lag: { from: 0, to: 0, timed: true } },
  { key: '01', label: 'Entro un giorno', lag: { from: 0, to: 1 } },
  { key: '0', label: 'Stesso giorno', lag: { from: 0, to: 0 } },
  { key: '1', label: 'Giorno dopo', lag: { from: 1, to: 1 } },
  { key: '2', label: 'Dopo due giorni', lag: { from: 2, to: 2 } },
];

const RELIABLE_DAYS = 28;

/** Soggetto della frase, in italiano naturale, per ogni fattore e finestra temporale. */
function exposure(id: string, name: string, lag: LagKey): string {
  if (id === 'stress-alto') {
    return {
      '24h': 'Dopo una giornata di stress alto',
      '0': 'Nei giorni di stress alto',
      '1': 'Il giorno dopo una giornata stressante',
      '01': 'Quando c’è stato stress alto quel giorno o il precedente',
      '2': 'Due giorni dopo una giornata stressante',
    }[lag];
  }
  if (id === 'cena-pesante') {
    return {
      '24h': 'Dopo una cena abbondante o tardiva',
      '0': 'Nei giorni con una cena abbondante o tardiva',
      '1': 'Il giorno dopo una cena abbondante o tardiva',
      '01': 'Quando c’è stata una cena abbondante o tardiva quel giorno o il precedente',
      '2': 'Due giorni dopo una cena abbondante o tardiva',
    }[lag];
  }
  if (id === 'sonno-scarso') {
    return {
      '24h': 'Nei giorni in cui hai dormito male',
      '0': 'Quando hai dormito male',
      '1': 'Il giorno dopo aver dormito male',
      '01': 'Quando hai dormito male quel giorno o il precedente',
      '2': 'Due giorni dopo aver dormito male',
    }[lag];
  }
  const n = name.toLowerCase();
  return {
    '24h': `Nelle 24 ore dopo aver consumato ${n}`,
    '0': `Nei giorni in cui consumi ${n}`,
    '1': `Il giorno dopo aver consumato ${n}`,
    '01': `Quando hai consumato ${n} il giorno stesso o quello prima`,
    '2': `Due giorni dopo aver consumato ${n}`,
  }[lag];
}

export function InsightsView() {
  const days = useDays();
  const symptoms = useActiveSymptoms();
  const nameOf = useFactorNames();
  const [targetKey, setTargetKey] = useState('overall');
  const [lagKey, setLagKey] = useState<LagKey>('24h');
  const [showWeak, setShowWeak] = useState(false);
  const [showAllFactors, setShowAllFactors] = useState(false);

  const res = useMemo(() => {
    if (!days) return null;
    const target: Target = targetKey === 'overall' ? { kind: 'overall' } : { kind: 'symptom', id: targetKey };
    const lag = LAGS.find((l) => l.key === lagKey)!.lag;
    return analyze(days, { symptomIds: symptoms.map((s) => s.id), target, lag });
  }, [days, symptoms, targetKey, lagKey]);

  if (!days || !res) return null;

  const targetName = targetKey === 'overall' ? null : symptoms.find((s) => s.id === targetKey)?.name;
  const rank = (r: FactorResult) => EVIDENCE[r.confidence].level * 100 + Math.abs(r.diff);
  const triggers = res.results.filter((r) => r.diff > 0 && r.confidence !== 'nessuna').sort((a, b) => rank(b) - rank(a));
  const helpers = res.results
    .filter((r) => r.diff < 0 && EVIDENCE[r.confidence].level >= 2)
    .sort((a, b) => rank(b) - rank(a));

  // Gli indizi deboli restano nascosti finché ci sono risultati più solidi: evitano rumore.
  const strong = triggers.filter((r) => EVIDENCE[r.confidence].level >= 2);
  const visibleTriggers = showWeak || strong.length === 0 ? triggers : strong;
  const factorRows = showAllFactors
    ? res.results
    : [...res.results].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 12).sort((a, b) => b.diff - a.diff);

  const sentence = (r: FactorResult) => {
    const subject = exposure(r.id, nameOf(r.id), lagKey);
    const what = targetName ? `${targetName.toLowerCase()} è` : 'i sintomi sono';
    return `${subject}, ${what} in media a ${num(r.meanExposed)} invece di ${num(r.meanUnexposed)}.`;
  };

  return (
    <>
      <header className="page-title">
        <div className="kicker">
          {res.observations} giornate confrontate · media {num(res.meanScore)} su 10
        </div>
        <h1>Cosa influisce sulla tua pancia</h1>
      </header>

      <section className="sheet">
        <div className="field-label">Sintomo</div>
        <div className="pills" role="group" aria-label="Sintomo da analizzare">
          <button className="pill" aria-pressed={targetKey === 'overall'} onClick={() => setTargetKey('overall')}>
            Tutti
          </button>
          {symptoms.map((s) => (
            <button key={s.id} className="pill" aria-pressed={targetKey === s.id} onClick={() => setTargetKey(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="field-label" style={{ marginTop: 16 }}>
          Quando compaiono
        </div>
        <div className="pills" role="group" aria-label="Finestra temporale">
          {LAGS.map((l) => (
            <button key={l.key} className="pill" aria-pressed={lagKey === l.key} onClick={() => setLagKey(l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </section>

      {res.observations < RELIABLE_DAYS && (
        <section className="note" style={{ marginTop: 14 }}>
          <strong>
            {res.observations} di {RELIABLE_DAYS} giornate
          </strong>{' '}
          per risultati affidabili.
          <div className="progress" aria-hidden>
            <i style={{ width: `${(res.observations / RELIABLE_DAYS) * 100}%` }} />
          </div>
          Registra con costanza, anche nei giorni senza sintomi: servono per il confronto.
        </section>
      )}

      <Sec title="Possibili trigger" aside={triggers.length ? `${visibleTriggers.length} di ${triggers.length}` : undefined} />
      {triggers.length === 0 ? (
        <p className="note">
          {res.results.length === 0
            ? 'Ancora nessun alimento con abbastanza giornate per un confronto.'
            : 'Per ora nessun alimento risulta legato a sintomi peggiori in questa finestra.'}
        </p>
      ) : (
        <section className="sheet flush">
          {visibleTriggers.map((r) => (
            <Finding key={r.id} r={r} name={nameOf(r.id)} sentence={sentence(r)} kind="worse" />
          ))}
          {strong.length > 0 && triggers.length > strong.length && (
            <button className="btn link" style={{ margin: '0 0 12px -4px' }} onClick={() => setShowWeak((v) => !v)}>
              {showWeak ? 'Nascondi gli indizi deboli' : `Mostra altri ${triggers.length - strong.length} indizi deboli`}
            </button>
          )}
        </section>
      )}

      {helpers.length > 0 && (
        <>
          <Sec title="Legati a giornate migliori" />
          <section className="sheet flush">
            {helpers.map((r) => (
              <Finding key={r.id} r={r} name={nameOf(r.id)} sentence={sentence(r)} kind="better" />
            ))}
          </section>
        </>
      )}

      {res.results.length > 0 && (
        <>
          <Sec title="Tutti i fattori" aside={`${res.results.length} confrontabili`} />
          <section className="sheet">
            <p className="faint small" style={{ margin: '0 0 14px' }}>
              Differenza della media (0–10) tra giornate con e senza ciascun fattore
              {showAllFactors ? '.' : ': i 12 più marcati.'}
            </p>
            <EffectChart results={factorRows} nameOf={nameOf} />
            {res.results.length > 12 && (
              <button className="btn link" style={{ marginTop: 10, marginLeft: -4 }} onClick={() => setShowAllFactors((v) => !v)}>
                {showAllFactors ? 'Mostra solo i più marcati' : `Mostra tutti i ${res.results.length} fattori`}
              </button>
            )}
            <details className="disclosure" style={{ marginTop: 10, borderTop: '1px solid var(--line)' }}>
              <summary>Tabella dettagliata</summary>
              <div className="body table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fattore</th>
                      <th title="Differenza semplice">Diff.</th>
                      <th title="Stima a parità degli altri alimenti">Netto</th>
                      <th>Evidenza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.results.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {nameOf(r.id)}
                          <span className="sub">
                            {num(r.meanExposed)} con · {num(r.meanUnexposed)} senza · {r.nExposed} gg
                          </span>
                        </td>
                        <td>{signed(r.diff)}</td>
                        <td>{signed(r.netEffect)}</td>
                        <td title={`${EVIDENCE[r.confidence].help} (p = ${r.pValue.toFixed(3)})`}>{EVIDENCE[r.confidence].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </>
      )}

      {res.insufficient.length > 0 && (
        <details className="disclosure" style={{ marginTop: 10 }}>
          <summary>
            <span>
              Dati insufficienti per {res.insufficient.length} fattori
              <span className="faint small" style={{ display: 'block', fontWeight: 400 }}>
                servono almeno 3 giornate con e 3 senza
              </span>
            </span>
          </summary>
          <div className="body">
            <p className="faint small" style={{ marginTop: 0 }}>
              {res.insufficient.map((f) => `${nameOf(f.id)} (${f.nExposed})`).join(' · ')}
            </p>
            <p className="faint small" style={{ marginBottom: 0 }}>
              Se qualcosa lo consumi quasi ogni giorno non si può confrontare: prova qualche giorno di pausa.
            </p>
          </div>
        </details>
      )}

      <Sec title="Come leggere i risultati" />
      <section className="sheet flush">
        <details className="disclosure">
          <summary>Cosa vuol dire “evidenza”</summary>
          <div className="body prose">
            {(['probabile', 'da-verificare', 'indizio'] as const).map((c) => (
              <p key={c}>
                <Evidence confidence={c} />
                <br />
                {EVIDENCE[c].help}
              </p>
            ))}
          </div>
        </details>
        <details className="disclosure">
          <summary>Due cibi che mangio sempre insieme?</summary>
          <div className="body prose">
            <p>
              Nella tabella, <strong>Netto</strong> stima l’effetto di ogni fattore a parità degli altri. Se pizza e birra vanno
              sempre in coppia, aiuta a capire quale delle due pesa davvero.
            </p>
          </div>
        </details>
        <details className="disclosure">
          <summary>E adesso cosa faccio?</summary>
          <div className="body prose">
            <p>
              Correlazione non vuol dire causa. Prendi un sospetto alla volta: escludilo per 2–3 settimane e poi reintroducilo,
              meglio se con un gastroenterologo o un dietista (per esempio con il protocollo low-FODMAP).
            </p>
            <p>
              <strong>Gutty non fa diagnosi.</strong> Sangue nelle feci, perdita di peso, febbre o sintomi che ti svegliano di
              notte vanno sempre segnalati al medico.
            </p>
          </div>
        </details>
      </section>
    </>
  );
}

function Finding({
  r,
  name,
  sentence,
  kind,
}: {
  r: FactorResult;
  name: string;
  sentence: string;
  kind: 'worse' | 'better';
}) {
  const isLifestyle = r.id in LIFESTYLE_FACTORS;
  return (
    <article className="finding">
      <div className="finding-head">
        <div className="who">
          <h3>{name}</h3>
          <Evidence confidence={r.confidence} />
        </div>
        <span className={`delta ${kind}`} title={`${signed(r.diff)} punti di media`}>
          {signed(r.diff)}
        </span>
      </div>
      <p>{sentence}</p>
      <div className="compare" aria-hidden>
        <span>{isLifestyle ? 'Sì' : 'Con'}</span>
        <span className="track">
          <i style={{ width: `${(r.meanExposed / 10) * 100}%`, background: `var(--${kind})` }} />
        </span>
        <span className="v">{num(r.meanExposed)}</span>
        <span>{isLifestyle ? 'No' : 'Senza'}</span>
        <span className="track">
          <i style={{ width: `${(r.meanUnexposed / 10) * 100}%`, background: 'var(--ink-3)' }} />
        </span>
        <span className="v">{num(r.meanUnexposed)}</span>
      </div>
      <div className="foot">
        {r.nExposed} giornate con, {r.nUnexposed} senza · giornate difficili {Math.round(r.badRateExposed * 100)}% contro{' '}
        {Math.round(r.badRateUnexposed * 100)}%
      </div>
    </article>
  );
}
