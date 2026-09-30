import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { addDays, todayISO } from '../date';
import { db, emptyDay, saveDay } from '../db';
import { FOOD_CATEGORIES, slugify } from '../defaults';
import { formatScore, overallScore, useActiveSymptoms, useDaysOrEmpty, useFoods } from '../hooks';
import type { DayEntry, Food } from '../types';
import { SectionLabel, Icon, dayMood, heatLevel, intensityWord } from '../ui';

const BRISTOL = ['Grumi duri separati', 'Salsiccia grumosa', 'Salsiccia screpolata', 'Liscia e morbida', 'Pezzi morbidi', 'Poltiglia', 'Liquida'];
const FALLBACK_FREQUENT = ['caffe', 'pasta-di-grano', 'pane', 'latte', 'pizza', 'cipolla', 'aglio', 'vino'];

const fmtDayMonth = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
const fmtWeekday = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });
const fmtWeekdayShort = new Intl.DateTimeFormat('it-IT', { weekday: 'short' });

function asDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface Props {
  date: string;
  onDateChange: (date: string) => void;
}

export function DayView({ date, onDateChange }: Props) {
  const today = todayISO();
  const symptoms = useActiveSymptoms();
  const foods = useFoods();
  const allDays = useDaysOrEmpty();
  const loaded = useLiveQuery(async () => ({ date, entry: await db.days.get(date) }), [date]);
  const [draft, setDraft] = useState<DayEntry | null>(null);

  // Il draft si inizializza dal database solo quando cambia giorno; poi è lui la fonte di verità.
  useEffect(() => {
    if (loaded && loaded.date === date) {
      setDraft((d) => (d?.date === date ? d : (loaded.entry ?? emptyDay(date))));
    }
  }, [loaded, date]);

  const scores = useMemo(() => new Map(allDays.map((d) => [d.date, overallScore(d, symptoms)])), [allDays, symptoms]);
  const yesterday = allDays.find((d) => d.date === addDays(date, -1));

  const frequent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of allDays) for (const f of d.foods) counts.set(f, (counts.get(f) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return (ranked.length >= 5 ? ranked : [...ranked, ...FALLBACK_FREQUENT]).filter((id, i, arr) => arr.indexOf(id) === i);
  }, [allDays]);

  if (!draft || draft.date !== date) return null;

  const update = (patch: Partial<DayEntry>) => {
    const next = { ...draft, ...patch, updatedAt: Date.now() };
    setDraft(next);
    void saveDay(next);
  };

  const toggleFood = (id: string) => {
    const has = draft.foods.includes(id);
    update({ foods: has ? draft.foods.filter((f) => f !== id) : [...draft.foods, id] });
  };

  const addFood = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    let id = slugify(clean) || `alimento-${Date.now()}`;
    const existing = foods.find((f) => f.id === id || f.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      id = existing.id;
      if (existing.archived) await db.foods.update(id, { archived: false });
    } else {
      await db.foods.add({ id, name: clean, category: 'Altro' });
    }
    if (!draft.foods.includes(id)) update({ foods: [...draft.foods, id] });
  };

  const touched = draft.updatedAt > 0;
  const score = touched ? overallScore(draft, symptoms) : undefined;
  const mood = dayMood(score);
  const relative = date === today ? 'Oggi' : date === addDays(today, -1) ? 'Ieri' : null;
  const weekday = fmtWeekday.format(asDate(date));

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">{relative ? `${relative} · ${weekday}` : weekday}</span>
        <h1 className="display">{fmtDayMonth.format(asDate(date))}</h1>
      </header>

      <WeekStrip date={date} today={today} scores={scores} onSelect={onDateChange} />

      <section className="sheet summary">
        <ScoreRing score={score} />
        <div>
          <h2 className="display">{mood.title}</h2>
          <p>{mood.line}</p>
          {relative !== 'Oggi' && (
            <button className="btn quiet" style={{ marginLeft: -10, marginTop: 4 }} onClick={() => onDateChange(today)}>
              Vai a oggi
            </button>
          )}
        </div>
      </section>

      <SectionLabel title="Sintomi" aside="tocca le barre" />
      <section className="sheet">
        {symptoms.map((s, i) => (
          <IntensityScale
            key={s.id}
            showLegend={i === 0}
            id={s.id}
            label={s.name}
            value={draft.symptoms[s.id] ?? 0}
            onChange={(v) => update({ symptoms: { ...draft.symptoms, [s.id]: v } })}
          />
        ))}
        <hr className="divider" />
        <div className="field-label">
          Feci <span className="faint">scala di Bristol</span>
        </div>
        <div className="bristol" role="group" aria-label="Scala di Bristol">
          {BRISTOL.map((label, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                aria-pressed={draft.bristol === n}
                aria-label={`Tipo ${n}: ${label}`}
                title={label}
                onClick={() => update({ bristol: draft.bristol === n ? undefined : n })}
              >
                <BristolGlyph type={n} />
                {n}
              </button>
            );
          })}
        </div>
        <div className="bristol-caption">
          <span>stitichezza</span>
          {draft.bristol ? <strong>{BRISTOL[draft.bristol - 1]}</strong> : <span>facoltativo</span>}
          <span>diarrea</span>
        </div>
      </section>

      <SectionLabel title="Cibo e bevande" aside={draft.foods.length ? `${draft.foods.length} nel piatto` : undefined} />
      <section className="sheet">
        <FoodPicker
          foods={foods}
          selected={draft.foods}
          frequent={frequent}
          onToggle={toggleFood}
          onAdd={addFood}
          onCopyYesterday={
            yesterday && yesterday.foods.some((f) => !draft.foods.includes(f))
              ? () => update({ foods: [...new Set([...draft.foods, ...yesterday.foods])] })
              : undefined
          }
        />
      </section>

      <SectionLabel title="Come stai" />
      <section className="sheet">
        <FivePoint
          label="Stress"
          value={draft.stress}
          low="rilassato"
          high="molto stressato"
          onChange={(stress) => update({ stress })}
        />
        <div style={{ height: 18 }} />
        <FivePoint label="Sonno" value={draft.sleep} low="pessimo" high="ottimo" onChange={(sleep) => update({ sleep })} />
        <hr className="divider" />
        <label className="field-label" htmlFor="notes">
          Note <span className="faint">facoltative</span>
        </label>
        <textarea
          id="notes"
          className="field"
          placeholder="Farmaci, ciclo, sport, pasti fuori casa…"
          value={draft.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </section>

      <p className="saved">
        {touched ? (
          <>
            <Icon name="check" size={16} /> Salvato sul dispositivo
          </>
        ) : (
          'Le modifiche si salvano da sole'
        )}
      </p>
    </>
  );
}

/* --------------------------------------------------------------------------------------------- */

function WeekStrip({
  date,
  today,
  scores,
  onSelect,
}: {
  date: string;
  today: string;
  scores: Map<string, number | undefined>;
  onSelect: (d: string) => void;
}) {
  const dow = (asDate(date).getDay() + 6) % 7; // lunedì = 0
  const monday = addDays(date, -dow);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const nextWeek = addDays(date, 7);

  return (
    <nav className="week" aria-label="Settimana">
      <button className="nav" aria-label="Settimana precedente" onClick={() => onSelect(addDays(date, -7))}>
        <Icon name="left" />
      </button>
      {days.map((d) => {
        const s = scores.get(d);
        const logged = scores.has(d);
        return (
          <button
            key={d}
            className={`day${d === today ? ' today' : ''}`}
            aria-current={d === date ? 'date' : undefined}
            disabled={d > today}
            onClick={() => onSelect(d)}
            aria-label={`${fmtWeekday.format(asDate(d))} ${asDate(d).getDate()}${logged ? `, sintomi ${formatScore(s)}` : ', non registrato'}`}
          >
            <span className="wd">{fmtWeekdayShort.format(asDate(d)).slice(0, 3)}</span>
            <span className="dn">{asDate(d).getDate()}</span>
            <span
              className="dot"
              style={logged && s !== undefined ? { background: `var(--heat-${heatLevel(s)})`, boxShadow: 'none' } : undefined}
            />
          </button>
        );
      })}
      <button
        className="nav"
        aria-label="Settimana successiva"
        disabled={date >= today}
        onClick={() => onSelect(nextWeek > today ? today : nextWeek)}
      >
        <Icon name="right" />
      </button>
    </nav>
  );
}

function ScoreRing({ score }: { score: number | undefined }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const frac = score === undefined ? 0 : Math.max(0.02, score / 10);
  return (
    <div className="ring" role="img" aria-label={score === undefined ? 'Nessun dato' : `Media sintomi ${formatScore(score)} su 10`}>
      <svg viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--heat-0)" strokeWidth="7" />
        {score !== undefined && score > 0 && (
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={`var(--heat-${Math.max(1, heatLevel(score))})`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${frac * c} ${c}`}
          />
        )}
      </svg>
      <div className="ring-value">
        <strong>{formatScore(score)}</strong>
        <span>su 10</span>
      </div>
    </div>
  );
}

function IntensityScale({
  id,
  label,
  value,
  showLegend,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  showLegend: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="symptom">
      <div className="symptom-head">
        <label id={`lbl-${id}`}>{label}</label>
        <span className="val">
          <strong>{value}</strong>
          {intensityWord(value)}
        </span>
      </div>
      <div className="scale" role="group" aria-labelledby={`lbl-${id}`}>
        {Array.from({ length: 11 }, (_, i) => {
          const on = i <= value && value > 0 && i > 0;
          const height = i === 0 ? 5 : 8 + i * 2.8;
          const bg = on ? `var(--heat-${Math.ceil(i / 2)})` : i === 0 && value === 0 ? 'var(--ink-3)' : undefined;
          return (
            <button key={i} aria-label={`${label}: ${i}`} aria-pressed={value === i} onClick={() => onChange(i)}>
              <span style={{ height, background: bg }} />
            </button>
          );
        })}
      </div>
      {showLegend && (
        <div className="scale-legend" aria-hidden>
          <span>0 · nessuno</span>
          <span>insopportabile · 10</span>
        </div>
      )}
    </div>
  );
}

function FivePoint({
  label,
  value,
  low,
  high,
  onChange,
}: {
  label: string;
  value: number | undefined;
  low: string;
  high: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="five" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-pressed={value === n} aria-label={`${label} ${n} su 5`} onClick={() => onChange(value === n ? undefined : n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="five-caption">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function BristolGlyph({ type }: { type: number }) {
  const common = { viewBox: '0 0 32 18', 'aria-hidden': true } as const;
  switch (type) {
    case 1:
      return (
        <svg {...common} fill="currentColor">
          <circle cx="7" cy="9" r="3.4" />
          <circle cx="16" cy="9.5" r="3" />
          <circle cx="25" cy="8.5" r="3.4" />
        </svg>
      );
    case 2:
      return (
        <svg {...common} fill="currentColor">
          <circle cx="6.5" cy="9" r="4" />
          <circle cx="12" cy="8" r="4.2" />
          <circle cx="17.5" cy="9.5" r="4" />
          <circle cx="23" cy="8.5" r="4.2" />
          <circle cx="27" cy="9.5" r="3.4" />
        </svg>
      );
    case 3:
      return (
        <svg {...common} fill="currentColor">
          <rect x="2" y="4.5" width="8.6" height="9" rx="4" />
          <rect x="11.8" y="4.5" width="8.4" height="9" rx="1.5" />
          <rect x="21.4" y="4.5" width="8.6" height="9" rx="4" />
        </svg>
      );
    case 4:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round">
          <path d="M4.5 11.5C10 4 17 14.5 27.5 6.5" />
        </svg>
      );
    case 5:
      return (
        <svg {...common} fill="currentColor">
          <ellipse cx="7" cy="10" rx="4.6" ry="3.6" />
          <ellipse cx="16.5" cy="8" rx="4.2" ry="3.3" />
          <ellipse cx="25.5" cy="10.5" rx="4.4" ry="3.2" />
        </svg>
      );
    case 6:
      return (
        <svg {...common} fill="currentColor">
          <path d="M4 12.5c-.4-2.6 2.2-4 4.4-3 .8-3 4.8-4 6.8-1.4 1.8-2.3 6-2.1 7 .8 2.8-.4 5.6 1.4 4.8 4-.6 1.8-2.6 2.1-4.6 2.1H8.4c-2.4 0-4.1-.6-4.4-2.5z" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 6.5q3.3-3 6.5 0t6.5 0 6.5 0 6.5 0" />
          <path d="M3 12.5q3.3-3 6.5 0t6.5 0 6.5 0 6.5 0" />
        </svg>
      );
  }
}

function FoodPicker({
  foods,
  selected,
  frequent,
  onToggle,
  onAdd,
  onCopyYesterday,
}: {
  foods: Food[];
  selected: string[];
  frequent: string[];
  onToggle: (id: string) => void;
  onAdd: (name: string) => Promise<void>;
  onCopyYesterday?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(FOOD_CATEGORIES[0]);
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const active = foods.filter((f) => !f.archived);
  const categories = [...new Set([...FOOD_CATEGORIES, ...active.map((f) => f.category)])];

  const q = search.trim().toLowerCase();
  const results = q ? active.filter((f) => f.name.toLowerCase().includes(q)) : [];
  const exact = foods.some((f) => f.name.toLowerCase() === q);
  const frequentFoods = frequent
    .map((id) => byId.get(id))
    .filter((f): f is Food => !!f && !f.archived && !selected.includes(f.id))
    .slice(0, 8);

  const submit = async () => {
    if (!q) return;
    if (results.length === 1) {
      if (!selected.includes(results[0].id)) onToggle(results[0].id);
    } else if (!exact) {
      await onAdd(search);
    } else {
      return;
    }
    setSearch('');
  };

  return (
    <>
      {selected.length === 0 ? (
        <p className="plate-empty">Il piatto è vuoto. Cerca o tocca gli alimenti qui sotto.</p>
      ) : (
        <div className="chips" aria-label="Nel piatto">
          {selected.map((id) => (
            <button key={id} className="chip on-plate" onClick={() => onToggle(id)} aria-label={`Rimuovi ${byId.get(id)?.name ?? id}`}>
              {byId.get(id)?.name ?? id}
              <span className="x">
                <Icon name="x" size={14} />
              </span>
            </button>
          ))}
        </div>
      )}
      {onCopyYesterday && (
        <button className="btn quiet" style={{ marginLeft: -10, marginTop: 6 }} onClick={onCopyYesterday}>
          <Icon name="plus" size={16} /> Aggiungi quello di ieri
        </button>
      )}

      <form
        className="field"
        style={{ marginTop: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Icon name="search" size={18} />
        <input type="search" placeholder="Cerca o aggiungi…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cerca alimento" />
        {search && (
          <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Svuota ricerca" onClick={() => setSearch('')}>
            <Icon name="x" size={16} />
          </button>
        )}
      </form>

      {q ? (
        <>
          <div className="sub-label">Risultati</div>
          <div className="chips">
            {results.map((f) => (
              <button key={f.id} className="chip" aria-pressed={selected.includes(f.id)} onClick={() => onToggle(f.id)}>
                {f.name}
              </button>
            ))}
            {!exact && (
              <button className="chip" style={{ borderStyle: 'dashed' }} onClick={() => void submit()}>
                <Icon name="plus" size={16} /> Crea “{search.trim()}”
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {frequentFoods.length > 0 && (
            <>
              <div className="sub-label">I più frequenti</div>
              <div className="chips">
                {frequentFoods.map((f) => (
                  <button key={f.id} className="chip" aria-pressed={false} onClick={() => onToggle(f.id)}>
                    {f.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="sub-label">Sfoglia</div>
          <div className="pills" role="group" aria-label="Categorie">
            {categories.map((c) => (
              <button key={c} className="pill" aria-pressed={c === category} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            {active
              .filter((f) => f.category === category)
              .map((f) => (
                <button key={f.id} className="chip" aria-pressed={selected.includes(f.id)} onClick={() => onToggle(f.id)}>
                  {f.name}
                </button>
              ))}
          </div>
        </>
      )}
    </>
  );
}
