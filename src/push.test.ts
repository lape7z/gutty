import { describe, expect, it } from 'vitest';
import { PUSH_URL, isFilled, markFilled } from './push';
import type { DayEntry } from './types';

const day = (extra: Partial<DayEntry> = {}): DayEntry => ({ date: '2026-10-07', foods: [], symptoms: {}, updatedAt: 0, ...extra });

describe('promemoria serale', () => {
  it('la giornata è compilata con almeno un alimento e i sintomi del pomeriggio', () => {
    expect(isFilled(day())).toBe(false);
    expect(isFilled(day({ foods: ['pane'] }))).toBe(false);
    expect(isFilled(day({ moments: { pomeriggio: { level: 0, symptoms: [] } } }))).toBe(false);
    expect(isFilled(day({ foods: ['pane'], moments: { pomeriggio: { level: 0, symptoms: [] } } }))).toBe(true);
  });

  it('senza server configurato non fa nulla (e non rompe il salvataggio)', () => {
    if (PUSH_URL) return;
    expect(() => markFilled(day({ foods: ['pane'], moments: { pomeriggio: { level: 1, symptoms: [] } } }), '2026-10-07')).not.toThrow();
  });
});
