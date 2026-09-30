import { mulberry32 } from './analysis';
import { addDays, todayISO } from './date';
import { DEFAULT_FOODS, DEFAULT_SYMPTOMS } from './defaults';
import type { DayEntry } from './types';

const COMMON = new Set(['caffe', 'pasta-di-grano', 'pane', 'riso', 'formaggi-stagionati']);

/**
 * Genera un diario finto con trigger nascosti, per provare l'analisi:
 * - cipolla → sintomi forti il GIORNO DOPO
 * - latte → gonfiore e aria lo STESSO GIORNO
 * - stress alto → più dolore lo stesso giorno
 */
export function generateDemo(days = 120, seed = 42, end = todayISO()): DayEntry[] {
  const rand = mulberry32(seed);
  const start = addDays(end, -(days - 1));
  const noise = () => (rand() - 0.5) * 2;
  const clamp = (v: number) => Math.max(0, Math.min(10, Math.round(v)));

  const raw = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const foods = DEFAULT_FOODS.filter((f) => rand() < (COMMON.has(f.id) ? 0.6 : 0.12)).map((f) => f.id);
    const stress = 1 + Math.floor(rand() * 5);
    const sleep = 1 + Math.floor(rand() * 5);
    return { date, foods, stress, sleep };
  });

  return raw.map((day, i) => {
    const yesterday = raw[i - 1];
    const onionYesterday = yesterday?.foods.includes('cipolla') ? 1 : 0;
    const milkToday = day.foods.includes('latte') ? 1 : 0;
    const stressHigh = day.stress >= 4 ? 1 : 0;

    const base = 1.5;
    const symptoms: Record<string, number> = {
      dolore: clamp(base + 3.5 * onionYesterday + 2 * stressHigh + noise()),
      gonfiore: clamp(base + 3 * onionYesterday + 3.5 * milkToday + noise()),
      gas: clamp(base + 2.5 * onionYesterday + 3 * milkToday + noise()),
      urgenza: clamp(base + 2 * onionYesterday + noise()),
    };
    const worst = Math.max(...Object.values(symptoms));
    return {
      ...day,
      symptoms: Object.fromEntries(DEFAULT_SYMPTOMS.map((s) => [s.id, symptoms[s.id] ?? 0])),
      bristol: worst >= 6 ? 6 : 4,
      updatedAt: Date.now(),
    };
  });
}
