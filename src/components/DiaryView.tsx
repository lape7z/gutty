import { useMemo, useState } from 'react';
import { addDays, formatLong, todayISO } from '../date';
import { overallScore, useActiveSymptoms, useDays, useFactorNames } from '../hooks';
import { LEVELS, MOMENT_INFO } from '../day';
import { Icon, MoodFace, Sec, heatLevel, heatStyle, levelWord } from '../ui';

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
  const [showAll, setShowAll] = useState(false);

  const byDate = useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days]);
  const scoreOf = useMemo(() => {
    const cache = new Map<string, number | undefined>();
    for (const d of days ?? []) cache.set(d.date, overallScore(d, symptoms));
    return cache;
  }, [days, symptoms]);


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
  // "Difficile" = in media almeno "Fastidio"
  const hard = monthScores.filter((v) => v >= 2).length;

  return (
    <>
      <header className="page-title">
        <div className="kicker">{days.length} giornate annotate</div>
        <h1>Il tuo diario</h1>
      </header>

      <section className="sheet">
        <div className="month-head">
          <h2>
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
            const label = `${formatLong(d)}${entry ? (s === undefined ? ': senza sintomi segnati' : `: in media ${levelWord(s).toLowerCase()}`) : future ? '' : ': non registrato'}`;
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
          <span>Nessun sintomo</span>
          {[0, 1, 2, 3, 4, 5].map((lv) => (
            <i key={lv} style={{ background: `var(--v-${lv})` }} />
          ))}
          <span>Forti</span>
        </div>
      </section>

      <div className="stats">
        <div className="stat">
          <strong>
            {monthEntries.length}
            <small>/{elapsed}</small>
          </strong>
          <span>giorni annotati</span>
        </div>
        <div className="stat">
          <strong className="word">{avg === undefined ? '–' : levelWord(avg)}</strong>
          <span>in media</span>
        </div>
        <div className="stat">
          <strong>{hard}</strong>
          <span>giornate difficili</span>
        </div>
      </div>

      <Sec title="Giornate" aside={monthEntries.length ? `${monthEntries.length} nel mese` : undefined} />
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
              const moments = MOMENT_INFO.filter((m) => d.moments?.[m.id])
                .map((m) => `${m.label} ${LEVELS[d.moments![m.id]!.level].label.toLowerCase()}`)
                .join(' · ');
              const meta = [d.bristol !== undefined && (d.bristol === 0 ? 'nessuna evacuazione' : `Bristol ${d.bristol}`), d.stress && `stress ${d.stress}/5`, d.sleep && `sonno ${d.sleep}/5`, d.bigDinner && 'cena pesante']
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={d.date}>
                  <button className="entry" onClick={() => onOpen(d.date)}>
                    <span className="badge" aria-label={s === undefined ? 'Senza sintomi segnati' : `In media ${levelWord(s).toLowerCase()}`}>
                      {s === undefined ? '–' : <MoodFace face={LEVELS[Math.round(s)].face} size={34} stroke={1.8} fill={`var(--v-${heatLevel(s)})`} color={`var(--v-ink-${heatLevel(s)})`} />}
                    </span>
                    <span>
                      <span className="title">{formatLong(d.date)}</span>
                      {moments && <span className="meta moments">{moments}</span>}
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
            <button className="btn link" style={{ margin: '0 0 10px -4px' }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Mostra meno' : `Mostra tutte (${monthEntries.length})`}
            </button>
          )}
        </section>
      )}
    </>
  );
}

