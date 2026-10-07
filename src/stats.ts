import { MOMENTS, dayScore, followUp } from './analysis';
import { addDays } from './date';
import { drinksOf } from './groups';
import type { DayEntry, Food, Moment } from './types';

/** Media e numero di valori: `mean` è undefined quando non c'è nessun dato. */
export interface Bucket {
  mean: number | undefined;
  n: number;
}

function bucket(values: number[]): Bucket {
  return { mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined, n: values.length };
}

/** Giornate dentro il periodo scelto (ultimi `days` giorni fino a `today`; `undefined` = tutto). */
export function inRange(entries: DayEntry[], today: string, days: number | undefined): DayEntry[] {
  if (days === undefined) return entries.filter((e) => e.date <= today);
  const from = addDays(today, -(days - 1));
  return entries.filter((e) => e.date >= from && e.date <= today);
}

/**
 * Media mobile "a finestra di calendario": per ogni giorno, la media dei valori registrati
 * negli ultimi `window` giorni. I giorni non registrati non contano come zero.
 */
export function movingAverage(values: (number | undefined)[], window = 7): (number | undefined)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== undefined);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : undefined;
  });
}

/** Livello medio (0-4) per momento della giornata. */
export function byMoment(entries: DayEntry[]): Record<Moment, Bucket> {
  const out = {} as Record<Moment, Bucket>;
  for (const m of MOMENTS) {
    out[m] = bucket(entries.map((e) => e.moments?.[m]?.level).filter((v): v is number => v !== undefined));
  }
  return out;
}

/** Media della giornata per giorno della settimana, da lunedì (0) a domenica (6). */
export function byWeekday(entries: DayEntry[], symptomIds: string[]): Bucket[] {
  const groups: number[][] = Array.from({ length: 7 }, () => []);
  for (const e of entries) {
    const s = dayScore(e, symptomIds, { kind: 'overall' });
    if (s === undefined) continue;
    const [y, m, d] = e.date.split('-').map(Number);
    groups[(new Date(y, m - 1, d).getDay() + 6) % 7].push(s);
  }
  return groups.map(bucket);
}

/** In quale quota dei momenti registrati compare ciascun sintomo. */
export function symptomFrequency(entries: DayEntry[], symptomIds: string[]): { id: string; count: number; share: number; total: number }[] {
  let total = 0;
  const counts = new Map(symptomIds.map((id) => [id, 0]));
  for (const e of entries) {
    for (const m of MOMENTS) {
      const log = e.moments?.[m];
      if (!log) continue;
      total++;
      for (const id of log.symptoms) if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
    }
  }
  return symptomIds
    .map((id) => ({ id, count: counts.get(id)!, share: total ? counts.get(id)! / total : 0, total }))
    .sort((a, b) => b.count - a.count);
}

/** Quante giornate per tipo di Bristol: indice 0 = nessuna evacuazione, 1-7 = tipo. */
export function bristolCounts(entries: DayEntry[]): number[] {
  const out = new Array<number>(8).fill(0);
  for (const e of entries) if (e.bristol !== undefined && e.bristol >= 0 && e.bristol <= 7) out[e.bristol]++;
  return out;
}

/** Media della giornata per livello (1-5) di un campo, es. stress o sonno. */
export function byLevel(entries: DayEntry[], symptomIds: string[], field: 'stress' | 'sleep'): Bucket[] {
  const groups: number[][] = Array.from({ length: 5 }, () => []);
  for (const e of entries) {
    const lv = e[field];
    const s = dayScore(e, symptomIds, { kind: 'overall' });
    if (lv === undefined || s === undefined) continue;
    groups[lv - 1].push(s);
  }
  return groups.map(bucket);
}

/**
 * Sintomi nelle 24 ore dopo, per numero di bicchieri di alcol: indice 0-4 = bicchieri, 5 = cinque o più.
 * L'alcol si fa sentire soprattutto la notte e il mattino dopo, per questo si usa la finestra delle 24 ore.
 */
export function byDrinks(entries: DayEntry[], all: DayEntry[], symptomIds: string[], foods: Food[]): Bucket[] {
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const byDate = new Map(all.map((e) => [e.date, e]));
  const groups: number[][] = Array.from({ length: 6 }, () => []);
  for (const e of entries) {
    const n = drinksOf(e, foodById);
    if (n === undefined) continue;
    const s = followUp(e, byDate.get(addDays(e.date, 1)), symptomIds);
    if (s === undefined) continue;
    groups[Math.min(5, n)].push(s);
  }
  return groups.map(bucket);
}
