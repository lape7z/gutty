import { describe, expect, it } from 'vitest';
import { analyze, benjaminiHochberg, buildObservations, mulberry32 } from './analysis';
import { addDays, daysBetween } from './date';
import { DEFAULT_FOODS, DEFAULT_SYMPTOMS } from './defaults';
import { generateDemo } from './demo';
import type { DayEntry } from './types';

const symptomIds = DEFAULT_SYMPTOMS.map((s) => s.id);
const demo = generateDemo(120, 42, '2026-06-30');

describe('date', () => {
  it('attraversa mesi, anni e ora legale', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
  });
});

describe('benjaminiHochberg', () => {
  it('corrisponde al calcolo manuale', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.5]);
    expect(q.map((v) => +v.toFixed(4))).toEqual([0.04, 0.0533, 0.0533, 0.5]);
  });
});

describe('buildObservations', () => {
  const day = (date: string, foods: string[], pain: number): DayEntry => ({
    date,
    foods,
    symptoms: { dolore: pain },
    updatedAt: 0,
  });

  it('scarta i giorni senza la giornata precedente registrata', () => {
    const entries = [day('2026-01-01', ['latte'], 1), day('2026-01-02', [], 5), day('2026-01-04', [], 2)];
    const obs = buildObservations(entries, { symptomIds: ['dolore'], target: { kind: 'overall' }, lag: { from: 1, to: 1 } });
    expect(obs).toHaveLength(1);
    expect(obs[0].y).toBe(5);
    expect([...obs[0].factors]).toEqual(['latte']);
  });

  it('unisce i fattori della finestra e deriva stress/sonno', () => {
    const entries: DayEntry[] = [
      { ...day('2026-01-01', ['latte'], 0), stress: 5 },
      { ...day('2026-01-02', ['caffe'], 3), sleep: 1 },
    ];
    const obs = buildObservations(entries, { symptomIds: ['dolore'], target: { kind: 'overall' }, lag: { from: 0, to: 1 } });
    expect(obs).toHaveLength(1);
    expect([...obs[0].factors].sort()).toEqual(['caffe', 'latte', 'sonno-scarso', 'stress-alto']);
  });
});

describe('analyze sui dati demo', () => {
  it('trova la cipolla come trigger del giorno dopo', () => {
    const res = analyze(demo, { symptomIds, target: { kind: 'overall' }, lag: { from: 1, to: 1 } });
    const top = res.results[0];
    expect(top.id).toBe('cipolla');
    expect(top.confidence).toBe('probabile');
    expect(top.netEffect).toBeGreaterThan(1.5);
  });

  it('trova il latte come trigger dello stesso giorno per il gonfiore', () => {
    const res = analyze(demo, { symptomIds, target: { kind: 'symptom', id: 'gonfiore' }, lag: { from: 0, to: 0 } });
    expect(res.results[0].id).toBe('latte');
    expect(res.results[0].confidence).toBe('probabile');
  });

  it('riconosce lo stress come fattore', () => {
    const res = analyze(demo, { symptomIds, target: { kind: 'symptom', id: 'dolore' }, lag: { from: 0, to: 0 } });
    const stress = res.results.find((r) => r.id === 'stress-alto');
    expect(stress?.confidence).toBe('probabile');
  });

  it('mette i veri trigger davanti alle coincidenze', () => {
    const res = analyze(demo, { symptomIds, target: { kind: 'overall' }, lag: { from: 0, to: 0 } });
    expect(res.results[0].id).toBe('latte');
    // La cipolla agisce il giorno dopo: nella finestra "stesso giorno" non deve emergere.
    expect(res.results.find((r) => r.id === 'cipolla')?.confidence).not.toBe('probabile');
    const byNet = [...res.results].sort((a, b) => b.netEffect - a.netEffect);
    expect(byNet[0].id).toBe('latte');
  });
});

describe('analyze su dati puramente casuali', () => {
  it('produce raramente falsi positivi "probabili"', () => {
    const rand = mulberry32(7);
    let falsePositives = 0;
    for (let run = 0; run < 5; run++) {
      const entries: DayEntry[] = Array.from({ length: 90 }, (_, i) => ({
        date: addDays('2026-01-01', i),
        foods: DEFAULT_FOODS.filter(() => rand() < 0.15).map((f) => f.id),
        symptoms: { dolore: Math.floor(rand() * 8) },
        updatedAt: 0,
      }));
      const res = analyze(entries, { symptomIds: ['dolore'], target: { kind: 'overall' }, lag: { from: 0, to: 0 }, seed: run });
      falsePositives += res.results.filter((r) => r.confidence === 'probabile').length;
    }
    expect(falsePositives).toBeLessThanOrEqual(1);
  });
});
