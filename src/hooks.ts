import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { dayScore } from './analysis';
import { db } from './db';
import { LIFESTYLE_FACTORS } from './defaults';
import type { DayEntry, Food, Symptom } from './types';

const EMPTY_FOODS: Food[] = [];
const EMPTY_SYMPTOMS: Symptom[] = [];
const EMPTY_DAYS: DayEntry[] = [];

export function useFoods(): Food[] {
  return useLiveQuery(() => db.foods.toArray(), [], EMPTY_FOODS);
}

export function useSymptoms(): Symptom[] {
  return useLiveQuery(() => db.symptoms.toArray(), [], EMPTY_SYMPTOMS);
}

export function useActiveSymptoms(): Symptom[] {
  const all = useSymptoms();
  return useMemo(() => all.filter((s) => !s.archived), [all]);
}

/** Tutte le giornate in ordine cronologico. */
export function useDays(): DayEntry[] | undefined {
  return useLiveQuery(() => db.days.orderBy('date').toArray(), []);
}

export function useDaysOrEmpty(): DayEntry[] {
  return useDays() ?? EMPTY_DAYS;
}

/** Nome leggibile per un alimento o un fattore di stile di vita. */
export function useFactorNames(): (id: string) => string {
  const foods = useFoods();
  return useMemo(() => {
    const map = new Map<string, string>(foods.map((f) => [f.id, f.name]));
    for (const [id, name] of Object.entries(LIFESTYLE_FACTORS)) map.set(id, name);
    return (id: string) => map.get(id) ?? id;
  }, [foods]);
}

export function overallScore(entry: DayEntry, symptoms: Symptom[]): number | undefined {
  return dayScore(
    entry,
    symptoms.map((s) => s.id),
    { kind: 'overall' },
  );
}

export function formatScore(v: number | undefined): string {
  return v === undefined ? '–' : v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
}
