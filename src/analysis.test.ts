import { describe, expect, it } from 'vitest';
import { analyze, benjaminiHochberg, buildObservations, dayScore, mulberry32 } from './analysis';
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
    expect(obs[0].y).toBe(2); // dolore 5 su 10 → 2 su 4
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

const timed = { from: 0, to: 0, timed: true };

describe('dayScore e momenti', () => {
  const base: DayEntry = { date: '2026-01-01', foods: [], symptoms: {}, updatedAt: 0 };

  it('usa la media dei soli momenti registrati', () => {
    const e: DayEntry = { ...base, moments: { mattina: { level: 0, symptoms: [] }, sera: { level: 4, symptoms: ['gonfiore'] } } };
    expect(dayScore(e, symptomIds, { kind: 'overall' })).toBe(2);
    expect(dayScore(e, symptomIds, { kind: 'symptom', id: 'gonfiore' })).toBe(2);
    expect(dayScore(e, symptomIds, { kind: 'symptom', id: 'dolore' })).toBe(0);
  });

  it('non conta come zero una giornata senza sintomi registrati', () => {
    expect(dayScore({ ...base, foods: ['latte'] }, symptomIds, { kind: 'overall' })).toBeUndefined();
  });

  it('legge i diari vecchi fatti solo di slider, riportandoli da 0-10 a 0-4', () => {
    const e: DayEntry = { ...base, symptoms: { dolore: 6, gonfiore: 2 } };
    expect(dayScore(e, ['dolore', 'gonfiore'], { kind: 'overall' })).toBeCloseTo(1.6);
  });

  it('per un singolo sintomo preferisce il dettaglio dello slider', () => {
    const e: DayEntry = { ...base, symptoms: { dolore: 7 }, moments: { sera: { level: 1, symptoms: ['dolore'] } } };
    expect(dayScore(e, symptomIds, { kind: 'symptom', id: 'dolore' })).toBeCloseTo(2.8);
    expect(dayScore(e, symptomIds, { kind: 'overall' })).toBe(1);
  });
});

describe('finestra delle 24 ore', () => {
  const day = (date: string, extra: Partial<DayEntry>): DayEntry => ({ date, foods: [], symptoms: {}, updatedAt: 0, ...extra });

  it('collega la cena alla mattina dopo e ignora la mattina dello stesso giorno', () => {
    const entries = [
      day('2026-01-01', {
        foods: ['cipolla'],
        bigDinner: true,
        moments: { mattina: { level: 4, symptoms: [] }, pomeriggio: { level: 0, symptoms: [] }, sera: { level: 1, symptoms: [] } },
      }),
      day('2026-01-02', { moments: { mattina: { level: 3, symptoms: [] } } }),
    ];
    const obs = buildObservations(entries, { symptomIds, target: { kind: 'overall' }, lag: timed });
    // (0 + 1 + 3) / 3 per il primo giorno; il secondo ha solo la mattina, che appartiene al giorno prima.
    expect(obs).toHaveLength(1);
    expect(obs[0].y).toBeCloseTo(4 / 3);
    expect([...obs[0].factors].sort()).toEqual(['cena-pesante', 'cipolla']);
  });

  it('per i diari vecchi usa la media del giorno e del giorno dopo', () => {
    const entries = [day('2026-01-01', { foods: ['latte'], symptoms: { dolore: 2 } }), day('2026-01-02', { symptoms: { dolore: 6 } })];
    const obs = buildObservations(entries, { symptomIds: ['dolore'], target: { kind: 'overall' }, lag: timed });
    expect(obs[0].y).toBeCloseTo(1.6);
  });
});

describe('analyze sui dati demo', () => {
  it('trova i quattro trigger nascosti nelle 24 ore', () => {
    const res = analyze(demo, { symptomIds, target: { kind: 'overall' }, lag: timed });
    const strong = res.results.filter((r) => r.confidence === 'probabile').map((r) => r.id);
    expect(strong.sort()).toEqual(['cena-pesante', 'cipolla', 'latte', 'stress-alto']);
    expect(res.results.find((r) => r.id === 'cipolla')!.netEffect).toBeGreaterThan(0.5);
  });

  it('distingue i sintomi: il latte gonfia, la cipolla fa male', () => {
    const gonfiore = analyze(demo, { symptomIds, target: { kind: 'symptom', id: 'gonfiore' }, lag: timed });
    expect(gonfiore.results[0].id).toBe('latte');
    expect(gonfiore.results.find((r) => r.id === 'cipolla')?.confidence).not.toBe('probabile');
    const dolore = analyze(demo, { symptomIds, target: { kind: 'symptom', id: 'dolore' }, lag: timed });
    expect(dolore.results[0].id).toBe('cipolla');
  });

  it('funzionano ancora le finestre a giorni interi', () => {
    const res = analyze(demo, { symptomIds, target: { kind: 'overall' }, lag: { from: 0, to: 0 } });
    expect(res.results[0].id).toBe('latte');
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
