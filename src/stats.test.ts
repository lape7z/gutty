import { describe, expect, it } from 'vitest';
import { bristolCounts, byDrinks, byLevel, bySport, drinksByDay, byMoment, byWeekday, inRange, movingAverage, symptomFrequency } from './stats';
import type { DayEntry } from './types';

const day = (date: string, extra: Partial<DayEntry> = {}): DayEntry => ({ date, foods: [], symptoms: {}, updatedAt: 0, ...extra });

describe('stats', () => {
  it('inRange prende gli ultimi N giorni fino a oggi', () => {
    const e = [day('2026-09-01'), day('2026-09-24'), day('2026-09-30'), day('2026-10-01')];
    expect(inRange(e, '2026-09-30', 7).map((d) => d.date)).toEqual(['2026-09-24', '2026-09-30']);
    expect(inRange(e, '2026-09-30', undefined)).toHaveLength(3);
  });

  it('la media mobile ignora i giorni vuoti invece di contarli zero', () => {
    expect(movingAverage([2, undefined, 4, undefined], 3)).toEqual([2, 2, 3, 4]);
    expect(movingAverage([undefined, undefined], 7)).toEqual([undefined, undefined]);
  });

  it('byMoment fa la media dei soli momenti registrati', () => {
    const e = [
      day('2026-09-01', { moments: { mattina: { level: 1, symptoms: [] }, sera: { level: 3, symptoms: [] } } }),
      day('2026-09-02', { moments: { sera: { level: 4, symptoms: [] } } }),
    ];
    const r = byMoment(e);
    expect(r.mattina).toEqual({ mean: 1, n: 1 });
    expect(r.pomeriggio).toEqual({ mean: undefined, n: 0 });
    expect(r.sera).toEqual({ mean: 3.5, n: 2 });
  });

  it('byWeekday parte dal lunedì', () => {
    // 28 settembre 2026 è lunedì, 4 ottobre domenica
    const e = [day('2026-09-28', { moments: { sera: { level: 2, symptoms: [] } } }), day('2026-10-04', { moments: { sera: { level: 4, symptoms: [] } } })];
    const r = byWeekday(e, []);
    expect(r[0]).toEqual({ mean: 2, n: 1 });
    expect(r[6]).toEqual({ mean: 4, n: 1 });
  });

  it('symptomFrequency conta la quota dei momenti in cui compare il sintomo', () => {
    const e = [
      day('2026-09-01', { moments: { mattina: { level: 2, symptoms: ['gonfiore'] }, sera: { level: 0, symptoms: [] } } }),
      day('2026-09-02', { moments: { pomeriggio: { level: 3, symptoms: ['gonfiore', 'dolore'] } } }),
    ];
    const [first, second] = symptomFrequency(e, ['dolore', 'gonfiore']);
    expect(first).toMatchObject({ id: 'gonfiore', count: 2, total: 3 });
    expect(first.share).toBeCloseTo(2 / 3);
    expect(second).toMatchObject({ id: 'dolore', count: 1 });
  });

  it('bristolCounts separa i giorni senza evacuazione', () => {
    expect(bristolCounts([day('a', { bristol: 0 }), day('b', { bristol: 4 }), day('c', { bristol: 4 }), day('d')])).toEqual([1, 0, 0, 0, 2, 0, 0, 0]);
  });

  it('byLevel raggruppa i sintomi per livello di stress', () => {
    const e = [
      day('2026-09-01', { stress: 5, moments: { sera: { level: 4, symptoms: [] } } }),
      day('2026-09-02', { stress: 5, moments: { sera: { level: 2, symptoms: [] } } }),
      day('2026-09-03', { stress: 1, moments: { sera: { level: 0, symptoms: [] } } }),
      day('2026-09-04', { stress: 3 }),
    ];
    const r = byLevel(e, [], 'stress');
    expect(r[4]).toEqual({ mean: 3, n: 2 });
    expect(r[0]).toEqual({ mean: 0, n: 1 });
    expect(r[2]).toEqual({ mean: undefined, n: 0 });
  });

  it('byDrinks guarda le 24 ore dopo e conta come 0 i giorni senza alcolici', () => {
    const foods = [
      { id: 'vino', name: 'Vino', category: 'Bevande' },
      { id: 'pane', name: 'Pane', category: 'Cereali' },
    ];
    const m = (level: number) => ({ level, symptoms: [] });
    const e = [
      day('2026-09-01', { foods: ['pane'], moments: { sera: m(0) } }),
      day('2026-09-02', { foods: ['vino'], drinks: 4, moments: { sera: m(2) } }),
      day('2026-09-03', { moments: { mattina: m(4) } }),
      day('2026-09-04', { foods: ['vino'], moments: { sera: m(3) } }), // bicchieri non indicati: escluso
      day('2026-09-05', { foods: ['pane'], drinks: 7, moments: { sera: m(1) } }),
    ];
    const r = byDrinks(e, e, [], foods);
    expect(r[0]).toEqual({ mean: 0, n: 1 });
    expect(r[4].n).toBe(1);
    expect(r[4].mean).toBeGreaterThan(2); // la sera (2) e la mattina dopo (4)
    expect(r[5]).toEqual({ mean: 1, n: 1 });
    expect(r.reduce((a, b) => a + b.n, 0)).toBe(3);
  });

  it('bySport separa i giorni senza sport e conta ogni momento in cui lo hai fatto', () => {
    const m = (level: number) => ({ level, symptoms: [] });
    const e = [
      day('2026-09-01', { moments: { sera: m(3) } }),
      day('2026-09-02', { sport: ['mattina'], moments: { sera: m(1) } }),
      day('2026-09-03', { sport: ['mattina', 'sera'], moments: { sera: m(0) } }),
      day('2026-09-04', { sport: ['pomeriggio'] }), // nessun sintomo segnato: non conta
    ];
    expect(bySport(e, [])).toEqual([
      { mean: 3, n: 1 },
      { mean: 0.5, n: 2 },
      { mean: undefined, n: 0 },
      { mean: 0, n: 1 },
    ]);
  });

  it('drinksByDay copre tutto il periodo e distingue "niente alcol" da "non si sa"', () => {
    const foods = [
      { id: 'vino', name: 'Vino', category: 'Bevande' },
      { id: 'pane', name: 'Pane', category: 'Cereali' },
    ];
    const e = [
      day('2026-09-01', { foods: ['pane'] }),
      day('2026-09-02', { foods: ['vino', 'pane'], drinks: 2 }),
      day('2026-09-04', { foods: ['vino'] }),
      day('2026-09-10', { drinks: 5 }), // fuori dal periodo
    ];
    expect(drinksByDay(e, '2026-09-01', '2026-09-05', foods)).toEqual([
      { date: '2026-09-01', drinks: 0, logged: true, names: [] },
      { date: '2026-09-02', drinks: 2, logged: true, names: ['Vino'] },
      { date: '2026-09-03', drinks: undefined, logged: false, names: [] },
      { date: '2026-09-04', drinks: undefined, logged: true, names: ['Vino'] },
      { date: '2026-09-05', drinks: undefined, logged: false, names: [] },
    ]);
  });
});
