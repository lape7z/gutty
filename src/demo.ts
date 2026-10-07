import { mulberry32 } from './analysis';
import { addDays, todayISO } from './date';
import { DEFAULT_FOODS, DEFAULT_SYMPTOMS } from './defaults';
import type { DayEntry, Meal, MomentLog } from './types';

const COMMON = new Set(['caffe', 'pasta-di-grano', 'pane', 'riso', 'formaggi-stagionati']);
const BREAKFAST = new Set(['caffe', 'latte', 'yogurt', 'pane', 'te', 'succhi-di-frutta', 'dolci', 'mela']);
const MEALS: Meal[] = ['colazione', 'pranzo', 'cena', 'fuoripasto'];
const ALCOHOL = new Set(['vino', 'birra', 'superalcolici']);

/**
 * Genera un diario finto con trigger nascosti, per provare l'analisi:
 * - cipolla → dolore e urgenza nelle ore successive (a cena: la notte e la mattina dopo)
 * - latte → gonfiore e aria nel pomeriggio
 * - stress alto → dolore la sera
 * - cena abbondante o tardiva → gonfiore la sera e la notte
 * - 3 o più bicchieri di alcol → fastidio la notte e urgenza la mattina dopo (1-2 bicchieri non pesano)
 */
export function generateDemo(days = 120, seed = 42, end = todayISO()): DayEntry[] {
  const rand = mulberry32(seed);
  // Generatore separato per l'alcol, così il resto del diario resta identico a prima.
  const drinkRand = mulberry32(seed + 1);
  const start = addDays(end, -(days - 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const raw = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const meals: Record<Meal, string[]> = { colazione: [], pranzo: [], cena: [], fuoripasto: [] };
    for (const f of DEFAULT_FOODS) {
      if (rand() >= (COMMON.has(f.id) ? 0.6 : 0.12)) continue;
      const meal = BREAKFAST.has(f.id) && rand() < 0.6 ? 'colazione' : pick(MEALS.slice(1));
      meals[meal].push(f.id);
    }
    const drinking = MEALS.some((m) => meals[m].some((f) => ALCOHOL.has(f)));
    return {
      date,
      meals,
      drinks: drinking ? 1 + Math.floor(drinkRand() * drinkRand() * 6) : 0,
      stress: 1 + Math.floor(rand() * 5),
      sleep: 1 + Math.floor(rand() * 5),
      bigDinner: rand() < 0.2,
    };
  });

  const moment = (level: number, symptoms: Set<string>): MomentLog => {
    const lv = Math.max(0, Math.min(4, Math.round(level)));
    return { level: lv, symptoms: lv === 0 ? [] : [...symptoms] };
  };

  return raw.map((day, i) => {
    const prev = raw[i - 1];
    const noise = () => rand() * 1.2 - 0.3;
    const onionAt = (d: typeof day | undefined, m: Meal) => (d?.meals[m].includes('cipolla') ? 1 : 0);
    const milkEarly = day.meals.colazione.includes('latte') || day.meals.pranzo.includes('latte') ? 1 : 0;

    const mattina = new Set<string>();
    const pomeriggio = new Set<string>();
    const sera = new Set<string>();

    let mLevel = noise();
    if ((prev?.drinks ?? 0) >= 3) {
      mLevel += 1.6;
      mattina.add('urgenza');
    }
    if (onionAt(prev, 'cena')) {
      mLevel += 2.4;
      mattina.add('dolore').add('urgenza');
    }

    let pLevel = noise();
    if (milkEarly) {
      pLevel += 2.4;
      pomeriggio.add('gonfiore').add('gas');
    }
    if (onionAt(day, 'colazione') || onionAt(day, 'pranzo')) {
      pLevel += 2;
      pomeriggio.add('dolore');
    }

    let sLevel = noise();
    if (onionAt(day, 'cena') || onionAt(day, 'fuoripasto')) {
      sLevel += 1.5;
      sera.add('dolore').add('urgenza');
    }
    if (day.stress >= 4) {
      sLevel += 1.3;
      sera.add('dolore');
    }
    if (day.drinks >= 3) {
      sLevel += 1;
      sera.add('gonfiore');
    }
    if (day.bigDinner) {
      sLevel += 1.3;
      sera.add('gonfiore');
    }

    for (const s of [mattina, pomeriggio, sera]) if (s.size === 0) s.add(pick(DEFAULT_SYMPTOMS).id);

    const foods = [...new Set(MEALS.flatMap((m) => day.meals[m]))];
    return {
      date: day.date,
      foods,
      meals: day.meals,
      stress: day.stress,
      sleep: day.sleep,
      bigDinner: day.bigDinner || undefined,
      drinks: day.drinks,
      symptoms: {},
      moments: {
        mattina: moment(mLevel, mattina),
        pomeriggio: moment(pLevel, pomeriggio),
        sera: moment(sLevel, sera),
      },
      bristol: Math.max(mLevel, pLevel) >= 2.5 ? 6 : 4,
      updatedAt: Date.now(),
    };
  });
}
