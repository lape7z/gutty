import { useState } from 'react';
import { db } from '../db';
import { GROUPS, SHELVES, groupName, groupsOf, shelvesOf } from '../groups';
import type { Food } from '../types';

/** Voce del menù per i cibi che l'app non ha ancora capito. */
export const UNSORTED = 'altro';

export function shelfLabel(id: string): string {
  return id === UNSORTED ? 'Da completare' : (groupName(id) ?? id);
}

/** Voci del menù che contengono almeno un cibo, nell'ordine dei gruppi; "Da completare" in fondo. */
export function availableShelves(foods: Food[]): string[] {
  const used = new Set(foods.flatMap((f) => shelvesOf(f)));
  return [...SHELVES.map((g) => g.id), UNSORTED].filter((id) => used.has(id));
}

/** Elenco breve dei gruppi di un cibo, es. "Pasta, pane e pizza · Pomodoro e sughi". */
export function groupSummary(food: Pick<Food, 'name' | 'groups'>): string {
  const g = groupsOf(food);
  return g.length ? g.map((id) => groupName(id)).join(' · ') : 'Non ancora riconosciuto';
}

/**
 * Cosa contiene un cibo. I gruppi riconosciuti dal nome partono già selezionati; toccandone uno lo
 * si aggiunge o toglie, e la scelta viene salvata sul cibo. Se il nome non dice nulla all'app,
 * mostra subito tutti i gruppi e chiede di sceglierli.
 */
export function FoodGroupEditor({ food, onDone }: { food: Food; onDone?: () => void }) {
  const current = groupsOf(food);
  const [showAll, setShowAll] = useState(current.length === 0);
  const visible = showAll ? GROUPS : GROUPS.filter((g) => current.includes(g.id));

  const toggle = (id: string) => {
    const next = current.includes(id) ? current.filter((g) => g !== id) : [...current, id];
    void db.foods.update(food.id, { groups: GROUPS.map((g) => g.id).filter((g) => next.includes(g)) });
  };

  return (
    <div className="group-editor">
      <div className="faint small" style={{ margin: '4px 0 8px' }}>
        {current.length === 0
          ? `Non conosco ancora “${food.name}”: tocca cosa contiene, così l’analisi lo conta insieme ai cibi simili.`
          : showAll
            ? 'Tocca per aggiungere o togliere:'
            : 'Contiene:'}
      </div>
      <div className="chips">
        {visible.map((g) => (
          <button key={g.id} className="chip sm" aria-pressed={current.includes(g.id)} title={g.hint} onClick={() => toggle(g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="row-actions" style={{ marginTop: 10 }}>
        {current.length > 0 && (
          <button className="btn link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Mostra solo quelli scelti' : 'Correggi'}
          </button>
        )}
        {onDone && (
          <button className="btn link" onClick={onDone}>
            Fatto
          </button>
        )}
      </div>
    </div>
  );
}
