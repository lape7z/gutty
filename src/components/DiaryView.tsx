import { useMemo, useState } from 'react';
import { addDays, formatLong, todayISO } from '../date';
import { formatScore, overallScore, useActiveSymptoms, useDays, useFactorNames } from '../hooks';
import { Icon, Sec, heatStyle } from '../ui';
import { TrendChart, type TrendPoint } from './TrendChart';

const RANGES = [30, 90] as const;
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const fmtMonth = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function DiaryView({ onOpen }: { onOpen: (date: string) => void }) {
  const days = useDays();
  const symptoms = useActiveSymptoms();
  const nameOf = useFactorNames();
  const today = todayISO();
  const [month, setMonth] = useState(monthOf(today));
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [showAll, setShowAll] = useState(false);

  const byDate = useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days]);
  const scoreOf = useMemo(() => {
    const cache = new Map<string, number | undefined>();
    for (const d of days ?? []) cache.set(d.date, overallScore(d, symptoms));
    return cache;
  }, [days, symptoms]);

  const points = useMemo(() => {
    const map = new Map<string, TrendPoint>();
    for (const d of days ?? []) {
      const names = d.foods.map(nameOf);
      map.set(d.date, {
        date: d.date,
        value: scoreOf.get(d.date),
        detail: names.length ? names.slice(0, 4).join(', ') + (names.length > 4 ? ` +${names.length - 4}` : '') : undefined,
      });
    }
    return map;
  }, [days, nameOf, scoreOf]);

  if (!days) return null;

  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: daysInMonth }, (_, i) => addDays(first, i));
  const monthEntries = days.filter((d) => monthOf(d.date) === month).reverse();
  const monthScores = monthEntries.map((d) => scoreOf.get(d.date)).filter((v): v is number => v !== undefined);
  const elapsed = month === monthOf(today) ? Number(today.slice(8)) : month < monthOf(today) ? daysInMonth : 0;
  const avg = monthScores.length ? monthScores.reduce((a, b) => a + b, 0) / monthScores.length : undefined;
  const hard = monthScores.filter((v) => v >= 5).length;

  return (
    <>
      <header className="page-title">
        <span className="mono">Archivio · {days.length} giornate</span>
        <h1 className="xp">Diario</h1>
      </header>

      <section className="sheet">
        <div className="month-head">
          <h2 className="xp">
            {fmtMonth.format(new Date(y, m - 1, 1))}
          </h2>
          <button className="icon-btn" aria-label="Mese precedente" onClick={() => setMonth(shiftMonth(month, -1))}>
            <Icon name="left" />
          </button>
          <button
            className="icon-btn"
            aria-label="Mese successivo"
            disabled={month >= monthOf(today)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <Icon name="right" />
          </button>
        </div>
        <div className="cal">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="wd" aria-hidden>
              {w}
            </div>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {cells.map((d) => {
            const entry = byDate.get(d);
            const s = scoreOf.get(d);
            const future = d > today;
            const label = `${formatLong(d)}${entry ? `: sintomi ${formatScore(s)} su 10` : future ? '' : ': non registrato'}`;
            return (
              <button
                key={d}
                className={`cell${entry ? '' : ' empty'}${d === today ? ' today' : ''}`}
                style={entry ? heatStyle(s) : future ? { opacity: 0.35 } : undefined}
                disabled={future}
                aria-label={label}
                title={label}
                onClick={() => onOpen(d)}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <div className="legend" aria-hidden>
          <span>0</span>
          {[0, 1, 2, 3, 4, 5].map((lv) => (
            <i key={lv} style={{ background: `var(--v-${lv})` }} />
          ))}
          <span>10</span>
        </div>
      </section>

      <div className="stats">
        <div className="stat">
          <strong>
            {monthEntries.length}
            <span className="faint" style={{ fontSize: '0.5em' }}>
              /{elapsed}
            </span>
          </strong>
          <span>giorni segnati</span>
        </div>
        <div className="stat">
          <strong>{formatScore(avg)}</strong>
          <span>media sintomi</span>
        </div>
        <div className="stat">
          <strong>{hard}</strong>
          <span>giornate difficili</span>
        </div>
      </div>

      {days.length > 1 && (
        <>
          <Sec
            n={1}
            title="Andamento"
            aside={
              <span className="pills" style={{ margin: 0, padding: 0 }} role="group" aria-label="Periodo">
                {RANGES.map((r) => (
                  <button key={r} className="pill" aria-pressed={range === r} onClick={() => setRange(r)}>
                    {r}g
                  </button>
                ))}
              </span>
            }
          />
          <section className="sheet">
            <TrendChart points={points} end={today} days={range} />
          </section>
        </>
      )}

      <Sec n={days.length > 1 ? 2 : 1} title="Giornate" aside={monthEntries.length ? `${monthEntries.length} nel mese` : undefined} />
      {monthEntries.length === 0 ? (
        <p className="note">
          Nessuna giornata registrata in questo mese.
          {days.length === 0 && ' Inizia da “Oggi”, oppure carica i dati di esempio da Impostazioni per vedere come funziona.'}
        </p>
      ) : (
        <section className="sheet flush">
          <ul className="entries">
            {(showAll ? monthEntries : monthEntries.slice(0, 7)).map((d) => {
              const s = scoreOf.get(d.date);
              const meta = [d.bristol && `Bristol ${d.bristol}`, d.stress && `stress ${d.stress}/5`, d.sleep && `sonno ${d.sleep}/5`]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={d.date}>
                  <button className="entry" onClick={() => onOpen(d.date)}>
                    <span className="badge" style={heatStyle(s)} aria-label={`Sintomi ${formatScore(s)} su 10`}>
                      {formatScore(s)}
                    </span>
                    <span>
                      <span className="title">{formatLong(d.date)}</span>
                      {meta && <span className="meta">{meta}</span>}
                      <span className="foods">{d.foods.length ? d.foods.map(nameOf).join(', ') : 'Nessun alimento segnato'}</span>
                      {d.notes && <span className="notes">{d.notes}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {monthEntries.length > 7 && (
            <button className="btn link" style={{ margin: '0 0 10px' }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Mostra meno' : `Mostra tutte (${monthEntries.length})`}
            </button>
          )}
        </section>
      )}
    </>
  );
}

