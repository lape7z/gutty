import { describe, expect, it } from 'vitest';
import { DEFAULT_FOODS } from './defaults';
import { groupName, groupsOf, suggestCategory, suggestGroups } from './groups';

const names = (s: string) => suggestGroups(s).map((g) => groupName(g));

describe('gruppi alimentari', () => {
  it('riconosce cibi simili a quelli in lista', () => {
    expect(suggestGroups('Focaccia')).toEqual(suggestGroups('Pane'));
    expect(suggestGroups('Feta')).toContain('g-lattosio');
    expect(suggestGroups('Formaggi freschi')).toContain('g-lattosio');
    expect(suggestGroups('Parmigiano')).toEqual(['g-stagionati']);
  });

  it('scompone i piatti composti', () => {
    expect(names('Pasta al ragù')).toEqual(['Frumento e glutine', 'Cipolla e aglio', 'Carne rossa e salumi', 'Pomodoro e sughi']);
    expect(suggestGroups('Pizza margherita')).toEqual(expect.arrayContaining(['g-frumento', 'g-lattosio', 'g-pomodoro']));
    expect(suggestCategory(suggestGroups('Pasta al ragù'))).toBe('Piatti');
  });

  it('non si fa ingannare da parole simili o da eccezioni', () => {
    expect(suggestGroups('Tagliatelle')).not.toContain('g-cipolla-aglio');
    expect(suggestGroups('Latte di mandorla')).not.toContain('g-lattosio');
    expect(suggestGroups('Pasta senza glutine')).not.toContain('g-frumento');
    expect(suggestGroups('Birra analcolica')).not.toContain('g-alcol');
    expect(suggestGroups('Pollo alla griglia')).not.toContain('g-carne');
    expect(suggestGroups('Dolcificanti (sorbitolo, xilitolo…)')).toEqual(['g-polioli']);
  });

  it('le bevande restano bevande', () => {
    expect(suggestGroups('Birra')).toEqual(expect.arrayContaining(['g-alcol', 'g-gassate']));
    expect(suggestCategory(suggestGroups('Birra'))).toBe('Bevande');
    expect(suggestCategory(suggestGroups('Cappuccino'))).toBe('Bevande');
    expect(suggestCategory(suggestGroups('Feta'))).toBe('Latticini');
  });

  it('i gruppi scelti a mano vincono su quelli suggeriti', () => {
    expect(groupsOf({ name: 'Focaccia', groups: ['g-grassi'] })).toEqual(['g-grassi']);
    expect(groupsOf({ name: 'Focaccia' })).toEqual(['g-frumento']);
  });

  it('i cibi della lista iniziale hanno gruppi sensati', () => {
    const byName = new Map(DEFAULT_FOODS.map((f) => [f.name, groupsOf(f)]));
    expect(byName.get('Latte')).toEqual(['g-lattosio']);
    expect(byName.get('Cipolla')).toEqual(['g-cipolla-aglio']);
    expect(byName.get('Vino')).toEqual(['g-alcol']);
    expect(byName.get('Caffè')).toEqual(['g-caffeina']);
    expect(byName.get('Riso')).toEqual([]);
  });
});
