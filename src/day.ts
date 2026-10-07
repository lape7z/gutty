import type { DayEntry, Meal, Moment } from './types';
import type { Face } from './ui';

export const MEALS: { id: Meal; label: string; phrase: string }[] = [
  { id: 'colazione', label: 'Colazione', phrase: 'a colazione' },
  { id: 'pranzo', label: 'Pranzo', phrase: 'a pranzo' },
  { id: 'cena', label: 'Cena', phrase: 'a cena' },
  { id: 'fuoripasto', label: 'Fuori pasto', phrase: 'fuori pasto' },
];

export const MOMENT_INFO: { id: Moment; label: string; hint: string }[] = [
  { id: 'mattina', label: 'Mattina', hint: 'fino a pranzo' },
  { id: 'pomeriggio', label: 'Pomeriggio', hint: 'fino a cena' },
  { id: 'sera', label: 'Sera e notte', hint: 'dopo cena e di notte' },
];

/** Quando si è fatta attività sportiva: gli stessi momenti dei sintomi, con nomi più brevi. */
export const SPORT_TIMES: { id: Moment; label: string }[] = [
  { id: 'mattina', label: 'Mattina' },
  { id: 'pomeriggio', label: 'Pomeriggio' },
  { id: 'sera', label: 'Sera' },
];

/** I cinque livelli rapidi (0-4), dal meglio al peggio. */
export const LEVELS: { face: Face; label: string }[] = [
  { face: 'happy', label: 'Bene' },
  { face: 'ok', label: 'Lieve' },
  { face: 'meh', label: 'Fastidio' },
  { face: 'sad', label: 'Male' },
  { face: 'awful', label: 'Malissimo' },
];

/** Alimenti per pasto; i diari vecchi (solo `foods`) finiscono in "Fuori pasto". */
export function mealsOf(entry: DayEntry): Record<Meal, string[]> {
  const out: Record<Meal, string[]> = { colazione: [], pranzo: [], cena: [], fuoripasto: [] };
  for (const m of MEALS) out[m.id] = [...(entry.meals?.[m.id] ?? [])];
  const placed = new Set(Object.values(out).flat());
  for (const f of entry.foods) if (!placed.has(f)) out.fuoripasto.push(f);
  return out;
}

/** Aggiorna i pasti tenendo allineato `foods`, che è ciò che usa l'analisi. */
export function withMeals(meals: Record<Meal, string[]>): Pick<DayEntry, 'meals' | 'foods'> {
  return { meals, foods: [...new Set(MEALS.flatMap((m) => meals[m.id]))] };
}

export function mealNow(now = new Date()): Meal {
  const h = now.getHours();
  if (h < 11) return 'colazione';
  if (h < 15) return 'pranzo';
  if (h < 18) return 'fuoripasto';
  return 'cena';
}

export function momentNow(now = new Date()): Moment {
  const h = now.getHours();
  if (h >= 5 && h < 13) return 'mattina';
  if (h >= 13 && h < 19) return 'pomeriggio';
  return 'sera';
}
