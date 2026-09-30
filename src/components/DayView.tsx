import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { addDays, formatLong, todayISO } from '../date';
import { db, emptyDay, saveDay } from '../db';
import { FOOD_CATEGORIES, slugify } from '../defaults';
import { formatScore, overallScore, useActiveSymptoms, useFoods } from '../hooks';
import type { DayEntry } from '../types';

const BRISTOL = ['Grumi duri', 'Salsiccia grumosa', 'Salsiccia screpolata', 'Liscia e morbida', 'Pezzi morbidi', 'Poltiglia', 'Liquida'];

function intensityLabel(v: number): string {
  if (v === 0) return 'assente';
  if (v <= 3) return 'lieve';
  if (v <= 6) return 'moderato';
  return 'forte';
}

interface Props {
  date: string;
  onDateChange: (date: string) => void;
}

export function DayView({ date, onDateChange }: Props) {
  const today = todayISO();
  const symptoms = useActiveSymptoms();
  const foods = useFoods();
  const loaded = useLiveQuery(async () => ({ date, entry: await db.days.get(date) }), [date]);
  const yesterday = useLiveQuery(() => db.days.get(addDays(date, -1)), [date]);
  const [draft, setDraft] = useState<DayEntry | null>(null);
  const [search, setSearch] = useState('');

  // Il draft si inizializza dal database solo quando cambia giorno; poi è lui la fonte di verità.
  useEffect(() => {
    if (loaded && loaded.date === date) {
      setDraft((d) => (d?.date === date ? d : (loaded.entry ?? emptyDay(date))));
    }
  }, [loaded, date]);

  if (!draft || draft.date !== date) return <p className="muted">Caricamento…</p>;

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
    setSearch('');
  };

  const score = overallScore(draft, symptoms);

  return (
    <>
      <div className="date-nav">
        <button className="icon-btn" aria-label="Giorno precedente" onClick={() => onDateChange(addDays(date, -1))}>
          ‹
        </button>
        <div className="date-label">
          <strong>{date === today ? 'Oggi' : formatLong(date)}</strong>
          <span className="muted small">
            {date === today ? formatLong(date).toLowerCase() : ''}
            {date !== today && (
              <button className="btn ghost small" onClick={() => onDateChange(today)}>
                Torna a oggi
              </button>
            )}
          </span>
        </div>
        <button
          className="icon-btn"
          aria-label="Giorno successivo"
          disabled={date >= today}
          onClick={() => onDateChange(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Sintomi</h2>
          <span className="spacer" />
          <span className="muted small">Media: {formatScore(score)} / 10</span>
        </div>
        {symptoms.map((s) => {
          const v = draft.symptoms[s.id] ?? 0;
          return (
            <div className="slider" key={s.id}>
              <div className="slider-head">
                <label htmlFor={`s-${s.id}`}>{s.name}</label>
                <span className="slider-value">
                  {v}
                  <span>{intensityLabel(v)}</span>
                </span>
              </div>
              <input
                id={`s-${s.id}`}
                type="range"
                min={0}
                max={10}
                step={1}
                value={v}
                onChange={(e) => update({ symptoms: { ...draft.symptoms, [s.id]: Number(e.target.value) } })}
              />
            </div>
          );
        })}

        <h3>Feci (scala di Bristol)</h3>
        <Segmented
          count={7}
          value={draft.bristol}
          onChange={(bristol) => update({ bristol })}
          labelFor={(n) => `Tipo ${n}: ${BRISTOL[n - 1]}`}
        />
        <div className="segmented-caption">
          <span>1 · stitichezza</span>
          <span>{draft.bristol ? BRISTOL[draft.bristol - 1] : 'tocca per scegliere'}</span>
          <span>diarrea · 7</span>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Cosa hai mangiato e bevuto</h2>
          <span className="spacer" />
          {yesterday && yesterday.foods.length > 0 && (
            <button
              className="btn small"
              onClick={() => update({ foods: [...new Set([...draft.foods, ...yesterday.foods])] })}
            >
              Come ieri
            </button>
          )}
        </div>
        <FoodPicker
          foods={foods}
          selected={draft.foods}
          search={search}
          onSearch={setSearch}
          onToggle={toggleFood}
          onAdd={addFood}
        />
      </section>

      <section className="card">
        <h2>Stile di vita</h2>
        <h3 style={{ marginTop: 0 }}>Stress</h3>
        <Segmented count={5} value={draft.stress} onChange={(stress) => update({ stress })} labelFor={(n) => `Stress ${n} su 5`} />
        <div className="segmented-caption">
          <span>basso</span>
          <span>alto</span>
        </div>
        <h3>Qualità del sonno</h3>
        <Segmented count={5} value={draft.sleep} onChange={(sleep) => update({ sleep })} labelFor={(n) => `Sonno ${n} su 5`} />
        <div className="segmented-caption">
          <span>pessimo</span>
          <span>ottimo</span>
        </div>
        <h3>Note</h3>
        <textarea
          placeholder="Farmaci, ciclo, attività fisica, pasti fuori casa…"
          value={draft.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </section>

      <p className="saved">{draft.updatedAt ? '✓ Salvato automaticamente sul dispositivo' : 'Le modifiche si salvano da sole'}</p>
    </>
  );
}

function Segmented({
  count,
  value,
  onChange,
  labelFor,
}: {
  count: 5 | 7;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  labelFor: (n: number) => string;
}) {
  return (
    <div className={`segmented cols-${count}`}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          aria-pressed={value === n}
          aria-label={labelFor(n)}
          title={labelFor(n)}
          onClick={() => onChange(value === n ? undefined : n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function FoodPicker({
  foods,
  selected,
  search,
  onSearch,
  onToggle,
  onAdd,
}: {
  foods: { id: string; name: string; category: string; archived?: boolean }[];
  selected: string[];
  search: string;
  onSearch: (s: string) => void;
  onToggle: (id: string) => void;
  onAdd: (name: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => foods.filter((f) => (!f.archived || selected.includes(f.id)) && (!q || f.name.toLowerCase().includes(q))),
    [foods, selected, q],
  );
  const categories = [...new Set([...FOOD_CATEGORIES, ...foods.map((f) => f.category)])];
  const exact = foods.some((f) => f.name.toLowerCase() === q);

  return (
    <>
      <form
        className="row"
        style={{ flexWrap: 'nowrap', marginBottom: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (visible.length === 1 && q) {
            if (!selected.includes(visible[0].id)) onToggle(visible[0].id);
            onSearch('');
          } else if (q && !exact) onAdd(search);
        }}
      >
        <input
          type="search"
          placeholder="Cerca o aggiungi un alimento…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Cerca alimento"
        />
        {q && !exact && (
          <button type="button" className="btn primary" style={{ whiteSpace: 'nowrap' }} onClick={() => onAdd(search)}>
            + Aggiungi
          </button>
        )}
      </form>
      {selected.length > 0 && <p className="muted small" style={{ margin: '0 0 6px' }}>{selected.length} selezionati</p>}
      {categories.map((cat) => {
        const items = visible.filter((f) => f.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h3>{cat}</h3>
            <div className="chips">
              {items.map((f) => (
                <button key={f.id} className="chip" aria-pressed={selected.includes(f.id)} onClick={() => onToggle(f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <p className="muted small">Nessun alimento trovato: premi “Aggiungi” per crearlo.</p>}
    </>
  );
}
