import { useState } from 'react';
import { db } from '../db';
import { FOOD_CATEGORIES } from '../defaults';
import { GROUPS, groupName, groupsOf } from '../groups';
import type { Food } from '../types';

/** Elenco breve dei gruppi di un cibo, es. "Frumento e glutine · Pomodoro e sughi". */
export function groupSummary(food: Pick<Food, 'name' | 'groups'>): string {
  const g = groupsOf(food);
  return g.length ? g.map((id) => groupName(id)).join(' · ') : 'Nessun gruppo';
}

/**
 * Modifica di gruppi e categoria di un cibo. I gruppi suggeriti dal nome partono già selezionati;
 * toccandone uno lo si aggiunge o toglie. Le scelte vengono salvate sul cibo.
 */
export function FoodGroupEditor({ food, categories, onDone }: { food: Food; categories: string[]; onDone?: () => void }) {
  const current = groupsOf(food);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? GROUPS : GROUPS.filter((g) => current.includes(g.id));

  const toggle = (id: string) => {
    const next = current.includes(id) ? current.filter((g) => g !== id) : [...current, id];
    void db.foods.update(food.id, { groups: GROUPS.map((g) => g.id).filter((g) => next.includes(g)) });
  };

  return (
    <div className="group-editor">
      <div className="ge-row">
        <span className="faint small">Categoria</span>
        <label className="field ge-select">
          <span className="sr-only">Categoria di {food.name}</span>
          <select value={food.category} onChange={(e) => void db.foods.update(food.id, { category: e.target.value })}>
            {[...new Set([...FOOD_CATEGORIES, ...categories, food.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="faint small" style={{ margin: '12px 0 8px' }}>
        {current.length ? 'Contiene (per l’analisi per gruppi):' : 'Nessun gruppo riconosciuto: scegline uno o più.'}
      </div>
      <div className="chips">
        {visible.map((g) => (
          <button key={g.id} className="chip sm" aria-pressed={current.includes(g.id)} title={g.hint} onClick={() => toggle(g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="row-actions" style={{ marginTop: 10 }}>
        <button className="btn link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Mostra solo quelli scelti' : current.length ? 'Modifica gruppi' : 'Scegli i gruppi'}
        </button>
        {onDone && (
          <button className="btn link" onClick={onDone}>
            Fatto
          </button>
        )}
      </div>
    </div>
  );
}
