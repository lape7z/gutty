import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { addDays, todayISO } from '../date';
import { db, emptyDay, saveDay } from '../db';
import { FOOD_CATEGORIES, slugify } from '../defaults';
import { overallScore, useActiveSymptoms, useDaysOrEmpty, useFoods } from '../hooks';
import { backupDue, saveBackup, snoozeBackup } from '../backup';
import { isAlcoholic, suggestCategory, suggestGroups } from '../groups';
import { FoodGroupEditor, groupSummary } from './FoodGroups';
import { LEVELS, MEALS, MOMENT_INFO, mealNow, mealsOf, momentNow, withMeals } from '../day';
import type { DayEntry, Food, Meal, Moment, MomentLog } from '../types';
import { Icon, Mascot, Sec, dayMood, heatLevel, levelWord, type Face } from '../ui';

const BRISTOL = ['Grumi duri separati', 'Salsiccia grumosa', 'Salsiccia screpolata', 'Liscia e morbida', 'Pezzi morbidi', 'Poltiglia', 'Liquida'];
const FALLBACK_FREQUENT = ['caffe', 'pasta-di-grano', 'pane', 'latte', 'pizza', 'cipolla', 'aglio', 'vino'];

const fmtWeekday = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });
const fmtWeekdayShort = new Intl.DateTimeFormat('it-IT', { weekday: 'short' });
const fmtDayMonth = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

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
  const [meal, setMeal] = useState<Meal>(() => mealNow());
  const [skipNight, setSkipNight] = useState(false);
  const [nudgeHidden, setNudgeHidden] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => setSavedAt(null), [date]);

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
    setSavedAt(null);
    void saveDay(next);
  };

  const meals = mealsOf(draft);
  // Quando si segna un alcolico e i bicchieri sono ancora a zero, si parte da 1: basta correggere.
  const setMealFoods = (m: Meal, list: string[], added?: Food) => {
    const patch: Partial<DayEntry> = withMeals({ ...meals, [m]: list });
    if (!draft.drinks && isAlcoholic(added)) patch.drinks = 1;
    update(patch);
  };

  const toggleFood = (id: string) => {
    const list = meals[meal];
    if (list.includes(id)) setMealFoods(meal, list.filter((f) => f !== id));
    else setMealFoods(meal, [...list, id], foods.find((f) => f.id === id));
  };

  // Un cibo nuovo prende categoria e gruppi dal nome (focaccia → Frumento, pasta al ragù → Piatti).
  // I gruppi non vengono salvati finché non li si modifica: così migliorano con le regole future.
  const addFood = async (name: string): Promise<string | undefined> => {
    const clean = name.trim();
    if (!clean) return;
    let id = slugify(clean) || `alimento-${Date.now()}`;
    const existing = foods.find((f) => f.id === id || f.name.toLowerCase() === clean.toLowerCase());
    let food: Food;
    if (existing) {
      id = existing.id;
      food = existing;
      if (existing.archived) await db.foods.update(id, { archived: false });
    } else {
      food = { id, name: clean, category: suggestCategory(suggestGroups(clean)) };
      await db.foods.add(food);
    }
    if (!meals[meal].includes(id)) setMealFoods(meal, [...meals[meal], id], food);
    return existing ? undefined : id;
  };

  const setMoment = (m: Moment, log: MomentLog | undefined) => {
    const moments = { ...draft.moments };
    if (log) moments[m] = log;
    else delete moments[m];
    update({ moments });
  };

  const score = overallScore(draft, symptoms);
  const mood = dayMood(score);
  const relative = date === today ? 'Oggi' : date === addDays(today, -1) ? 'Ieri' : null;
  const weekday = fmtWeekday.format(asDate(date));
  const nowMoment = date === today ? momentNow() : null;
  const yesterdayMeals = yesterday ? mealsOf(yesterday)[meal] : [];
  const mealPhrase = MEALS.find((m) => m.id === meal)!.phrase;

  // La mattina chiediamo com'è andata la notte appena passata (che appartiene a ieri).
  const askNight = date === today && new Date().getHours() < 15 && !yesterday?.moments?.sera && !skipNight;
  const saveNight = (level: number) => {
    const base = yesterday ?? emptyDay(addDays(today, -1));
    void saveDay({ ...base, moments: { ...base.moments, sera: { level, symptoms: [] } }, updatedAt: Date.now() });
  };

  // Il salvataggio avviene già a ogni tocco: il pulsante lo ripete e lo conferma, per stare tranquilli.
  const confirmSave = async () => {
    await saveDay(draft);
    const stored = await db.days.get(draft.date);
    if (stored) setSavedAt(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
  };

  const showNudge = date === today && !nudgeHidden && backupDue(allDays.length);
  const doBackup = async () => {
    const { result } = await saveBackup();
    if (result !== 'cancelled' && result !== 'failed') setNudgeHidden(true);
  };

  return (
    <>
      <header className="hello">
        <div>
          <div className="kicker">{relative === 'Oggi' ? greeting() : relative ?? 'Diario'}</div>
          <h1>
            {weekday.charAt(0).toUpperCase() + weekday.slice(1)} {fmtDayMonth.format(asDate(date))}
          </h1>
        </div>
        {relative !== 'Oggi' && (
          <button className="today-link" onClick={() => onDateChange(today)}>
            Oggi
          </button>
        )}
      </header>

      <WeekStrip date={date} today={today} scores={scores} onSelect={onDateChange} />

      {showNudge && (
        <section className="backup-nudge" aria-label="Promemoria backup">
          <Icon name="download" />
          <div>
            <strong>Salva una copia del diario</strong>
            <p>I dati stanno solo su questo telefono. Con un backup su iCloud, Drive o email non li perdi mai.</p>
            <div className="row-actions">
              <button className="btn" onClick={() => void doBackup()}>
                Salva backup
              </button>
              <button
                className="btn link"
                onClick={() => {
                  snoozeBackup();
                  setNudgeHidden(true);
                }}
              >
                Più tardi
              </button>
            </div>
          </div>
        </section>
      )}

      {askNight && (
        <section className="night" aria-label="Ieri sera e stanotte">
          <div className="night-head">
            <strong>Com’è andata ieri sera e stanotte?</strong>
            <button className="btn link" onClick={() => setSkipNight(true)}>
              Salta
            </button>
          </div>
          <LevelPicker label="Ieri sera e stanotte" value={undefined} onChange={(lv) => lv !== undefined && saveNight(lv)} />
        </section>
      )}

      <section className="mood" aria-live="polite">
        <Mascot face={mood.face} />
        <h2>{mood.title}</h2>
        <p>{mood.line}</p>
        {score !== undefined && (
          <span className="score-chip">
            In media: <strong>{levelWord(score).toLowerCase()}</strong>
          </span>
        )}
      </section>

      <Sec title="Come va la pancia" aside="un tocco per momento" />
      <section className="sheet">
        {MOMENT_INFO.map((info, i) => (
          <div key={info.id}>
            {i > 0 && <hr className="divider" />}
            <MomentRow
              info={info}
              log={draft.moments?.[info.id]}
              isNow={nowMoment === info.id}
              symptoms={symptoms}
              onChange={(log) => setMoment(info.id, log)}
            />
          </div>
        ))}
        <hr className="divider" />
        <div className="field-label">
          Feci <span className="faint">scala di Bristol</span>
        </div>
        <div className="bristol" role="group" aria-label="Scala di Bristol">
          <button
            className="none"
            aria-pressed={draft.bristol === 0}
            aria-label="Nessuna evacuazione"
            title="Nessuna evacuazione"
            onClick={() => update({ bristol: draft.bristol === 0 ? undefined : 0 })}
          >
            <BristolGlyph type={0} />
            No
          </button>
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
          {draft.bristol === undefined ? (
            <span>facoltativo</span>
          ) : (
            <strong>{draft.bristol === 0 ? 'Nessuna evacuazione' : BRISTOL[draft.bristol - 1]}</strong>
          )}
          <span>diarrea</span>
        </div>
      </section>

      <Sec title="Cosa hai mangiato" aside={draft.foods.length ? `${draft.foods.length} in tutto` : undefined} />
      <section className="sheet">
        <div className="meal-tabs" role="tablist" aria-label="Pasto">
          {MEALS.map((m) => (
            <button key={m.id} role="tab" aria-selected={meal === m.id} onClick={() => setMeal(m.id)}>
              {m.label}
              {meals[m.id].length > 0 && <span className="count">{meals[m.id].length}</span>}
            </button>
          ))}
        </div>
        {meal === 'cena' && (
          <label className="toggle-row">
            <span>
              Cena abbondante o tardiva
              <span className="hint">anche questo può pesare</span>
            </span>
            <button
              className="switch"
              role="switch"
              aria-checked={!!draft.bigDinner}
              aria-label="Cena abbondante o tardiva"
              onClick={() => update({ bigDinner: draft.bigDinner ? undefined : true })}
            />
          </label>
        )}
        <FoodPicker
          foods={foods}
          selected={meals[meal]}
          mealPhrase={mealPhrase}
          frequent={frequent}
          onToggle={toggleFood}
          onAdd={addFood}
          onCopyYesterday={
            yesterdayMeals.some((f) => !meals[meal].includes(f))
              ? () => setMealFoods(meal, [...new Set([...meals[meal], ...yesterdayMeals])])
              : undefined
          }
        />
        <hr className="divider" />
        <DrinksStepper value={draft.drinks} onChange={(drinks) => update({ drinks })} />
      </section>

      <Sec title="Come ti senti" />
      <section className="sheet">
        <FacePicker label="Stress" value={draft.stress} options={STRESS} onChange={(stress) => update({ stress })} />
        <hr className="divider" />
        <FacePicker label="Sonno" value={draft.sleep} options={SLEEP} onChange={(sleep) => update({ sleep })} />
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

      <div className="save-day">
        <button className="btn block" disabled={draft.updatedAt === 0} onClick={() => void confirmSave()}>
          <Icon name="check" size={18} /> Salva la giornata
        </button>
        <p className="saved" aria-live="polite">
          {draft.updatedAt === 0
            ? 'Segna qualcosa: si salva anche da solo, a ogni tocco.'
            : savedAt
              ? `Salvata alle ${savedAt}. Puoi tornare a modificarla quando vuoi.`
              : `Salvata in automatico alle ${new Date(draft.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}. Resta modificabile.`}
        </p>
      </div>
    </>
  );
}

/** Un momento della giornata: una faccina e, se c'è fastidio, quali sintomi. */
function MomentRow({
  info,
  log,
  isNow,
  symptoms,
  onChange,
}: {
  info: (typeof MOMENT_INFO)[number];
  log: MomentLog | undefined;
  isNow: boolean;
  symptoms: { id: string; name: string }[];
  onChange: (log: MomentLog | undefined) => void;
}) {
  return (
    <div className="moment">
      <div className="moment-head">
        <strong>{info.label}</strong>
        <span className="faint">{info.hint}</span>
        {isNow && <span className="now">adesso</span>}
      </div>
      <LevelPicker
        label={info.label}
        value={log?.level}
        onChange={(level) => onChange(level === undefined ? undefined : { level, symptoms: level === 0 ? [] : (log?.symptoms ?? []) })}
      />
      {log && log.level > 0 && (
        <div className="moment-symptoms">
          <span className="faint small">Cosa senti?</span>
          <div className="chips">
            {symptoms.map((s) => {
              const on = log.symptoms.includes(s.id);
              return (
                <button
                  key={s.id}
                  className="chip sm"
                  aria-pressed={on}
                  onClick={() => onChange({ ...log, symptoms: on ? log.symptoms.filter((x) => x !== s.id) : [...log.symptoms, s.id] })}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LevelPicker({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <div className="faces" role="group" aria-label={label}>
      {LEVELS.map((l, lv) => (
        <button key={lv} aria-pressed={value === lv} aria-label={`${label}: ${l.label}`} onClick={() => onChange(value === lv ? undefined : lv)}>
          <Mascot face={l.face} size={38} still />
          {l.label}
        </button>
      ))}
    </div>
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

  return (
    <nav className="week" aria-label="Settimana">
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
            aria-label={`${fmtWeekday.format(asDate(d))} ${asDate(d).getDate()}${!logged ? ', non registrato' : s === undefined ? ', senza sintomi segnati' : `, in media ${levelWord(s).toLowerCase()}`}`}
          >
            <span className="wd">{fmtWeekdayShort.format(asDate(d)).slice(0, 3)}</span>
            <span className="dn">{asDate(d).getDate()}</span>
            <span className="dot" style={logged && s !== undefined ? { background: s > 0 ? `var(--v-${heatLevel(s)})` : 'var(--better)' } : undefined} />
          </button>
        );
      })}
    </nav>
  );
}

const STRESS: { face: Face; label: string }[] = [
  { face: 'zen', label: 'Calmo' },
  { face: 'happy', label: 'Sereno' },
  { face: 'ok', label: 'Normale' },
  { face: 'meh', label: 'Teso' },
  { face: 'sad', label: 'Stressato' },
];
const SLEEP: { face: Face; label: string }[] = [
  { face: 'sad', label: 'Pessimo' },
  { face: 'meh', label: 'Scarso' },
  { face: 'ok', label: 'Normale' },
  { face: 'happy', label: 'Buono' },
  { face: 'zen', label: 'Ottimo' },
];

function FacePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | undefined;
  options: { face: Face; label: string }[];
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <div className="field-label">
        {label}
        <span className="faint">{value ? options[value - 1].label : 'tocca una faccina'}</span>
      </div>
      <div className="faces" role="group" aria-label={label}>
        {options.map((o, i) => {
          const n = i + 1;
          return (
            <button key={n} aria-pressed={value === n} aria-label={`${label}: ${o.label}`} onClick={() => onChange(value === n ? undefined : n)}>
              <Mascot face={o.face} size={38} still />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BristolGlyph({ type }: { type: number }) {
  const common = { viewBox: '0 0 32 18', 'aria-hidden': true } as const;
  switch (type) {
    case 0:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="16" cy="9" r="6" />
          <path d="M11.8 13.2l8.4-8.4" />
        </svg>
      );
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
  mealPhrase,
  frequent,
  onToggle,
  onAdd,
  onCopyYesterday,
}: {
  foods: Food[];
  selected: string[];
  mealPhrase: string;
  frequent: string[];
  onToggle: (id: string) => void;
  onAdd: (name: string) => Promise<string | undefined>;
  onCopyYesterday?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
      const id = await onAdd(search);
      setAdded(id ?? null);
      setEditing(false);
    } else {
      return;
    }
    setSearch('');
  };

  return (
    <>
      {selected.length === 0 ? (
        <p className="plate-empty">Ancora niente {mealPhrase}. Cerca un alimento o sceglilo qui sotto.</p>
      ) : (
        <div className="chips" aria-label="Nel piatto">
          {selected.map((id) => (
            <button key={id} className="chip on-plate" onClick={() => onToggle(id)} aria-label={`Rimuovi ${byId.get(id)?.name ?? id}`}>
              {byId.get(id)?.name ?? id}
              <span className="x">
                <Icon name="x" size={13} />
              </span>
            </button>
          ))}
        </div>
      )}
      {added && byId.get(added) && (
        <NewFoodCard food={byId.get(added)!} foods={foods} editing={editing} onEdit={() => setEditing(true)} onClose={() => setAdded(null)} />
      )}
      {onCopyYesterday && (
        <button className="btn link" style={{ marginTop: 8, marginLeft: -4 }} onClick={onCopyYesterday}>
          <Icon name="plus" size={16} /> Come ieri {mealPhrase}
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
          <button type="button" aria-label="Svuota ricerca" onClick={() => setSearch('')} style={{ display: 'grid' }}>
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
              <button className="chip dashed" onClick={() => void submit()}>
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
          <div className="sub-label">Tutte le categorie</div>
          <div className="pills" role="group" aria-label="Categorie">
            {categories.map((c) => (
              <button key={c} className="pill" aria-pressed={c === category} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
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

/** Dopo aver creato un cibo: mostra in che gruppi è stato messo, con la possibilità di correggere. */
function NewFoodCard({ food, foods, editing, onEdit, onClose }: { food: Food; foods: Food[]; editing: boolean; onEdit: () => void; onClose: () => void }) {
  const categories = [...new Set(foods.map((f) => f.category))];
  return (
    <div className="new-food" role="status">
      <div className="nf-head">
        <div>
          <strong>“{food.name}” aggiunto</strong>
          {!editing && (
            <div className="faint small">
              {food.category} · {groupSummary(food)}
            </div>
          )}
        </div>
        <button className="icon-btn" aria-label="Chiudi" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>
      {editing ? (
        <FoodGroupEditor food={food} categories={categories} onDone={onClose} />
      ) : (
        <button className="btn link" style={{ marginLeft: -4 }} onClick={onEdit}>
          Correggi i gruppi
        </button>
      )}
    </div>
  );
}

/** Quanti bicchieri di alcol nella giornata: conta la quantità, non solo il tipo. */
function DrinksStepper({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const n = value ?? 0;
  return (
    <div className="drinks">
      <div>
        <div className="field-label" style={{ margin: 0 }}>
          Bicchieri di alcol
        </div>
        <div className="hint">1 = una birra piccola, un calice di vino o un cicchetto</div>
      </div>
      <div className="stepper" role="group" aria-label="Bicchieri di alcol">
        <button aria-label="Un bicchiere in meno" disabled={n === 0} onClick={() => onChange(n - 1)}>
          −
        </button>
        <output aria-live="polite">{value === undefined ? '0' : value}</output>
        <button aria-label="Un bicchiere in più" disabled={n >= 15} onClick={() => onChange(n + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
