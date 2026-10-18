import { describe, expect, it } from 'vitest';
import { DEFAULT_FOODS } from './defaults';
import { groupName, groupsOf, shelvesOf, suggestGroups } from './groups';

const names = (s: string) => suggestGroups(s).map((g) => groupName(g));
const has = (s: string, ...groups: string[]) => expect(suggestGroups(s)).toEqual(expect.arrayContaining(groups));

describe('gruppi alimentari', () => {
  it('riconosce cibi simili a quelli in lista', () => {
    expect(suggestGroups('Focaccia')).toEqual(suggestGroups('Pane'));
    has('Feta', 'g-lattosio');
    has('Formaggi freschi', 'g-lattosio');
    expect(suggestGroups('Formaggi freschi')).not.toContain('g-stagionati');
    expect(suggestGroups('Parmigiano')).toEqual(['g-stagionati']);
  });

  it('capisce la frutta e la verdura anche se non sono nella lista', () => {
    for (const f of ['Kiwi', 'Fragole', 'Banana', 'Ananas', 'Mandarini', 'Melone', 'Mirtilli']) has(f, 'g-frutta-tutta');
    for (const v of ['Zucchine', 'Insalata mista', 'Melanzane', 'Spinaci', 'Carote']) has(v, 'g-verdura');
    // La mela è frutta ricca di fruttosio, il kiwi no.
    has('Mela', 'g-frutta-tutta', 'g-frutta');
    expect(suggestGroups('Kiwi')).not.toContain('g-frutta');
  });

  it('la pasta ripiena è pasta, con il suo ripieno', () => {
    for (const p of ['Anolini', 'Tortellini', 'Cappelletti', 'Agnolotti']) has(p, 'g-frumento', 'g-uova', 'g-stagionati', 'g-carne');
    has('Ravioli ricotta e spinaci', 'g-frumento', 'g-lattosio', 'g-verdura');
    has('Anolini in brodo', 'g-cipolla-aglio');
    for (const p of ['Strozzapreti', 'Orecchiette', 'Paccheri', 'Gnocchetti sardi']) has(p, 'g-frumento');
  });

  it('scompone i piatti composti', () => {
    expect(names('Pasta al ragù')).toEqual(['Pasta, pane e pizza', 'Carne rossa e salumi', 'Cipolla e aglio', 'Pomodoro e sughi']);
    has('Pizza margherita', 'g-frumento', 'g-lattosio', 'g-pomodoro');
    has('Carbonara', 'g-frumento', 'g-uova', 'g-carne', 'g-stagionati');
    has('Spaghetti alle vongole', 'g-frumento', 'g-pesce', 'g-cipolla-aglio');
    has('Lasagne', 'g-frumento', 'g-carne', 'g-lattosio', 'g-pomodoro');
    has('Sushi', 'g-cereali', 'g-pesce');
    has('Tiramisù', 'g-dolci', 'g-lattosio', 'g-uova', 'g-caffeina');
  });

  it('perdona gli errori di battitura, ma non inventa', () => {
    expect(suggestGroups('Tortelini')).toEqual(suggestGroups('Tortellini'));
    has('Anolni', 'g-frumento', 'g-carne');
    has('Mozarella', 'g-lattosio');
    has('Fragle', 'g-frutta-tutta');
    // "pasto" non è "pasta".
    expect(suggestGroups('Pasto abbondante')).toEqual([]);
  });

  it('non si fa ingannare da parole simili o da eccezioni', () => {
    expect(suggestGroups('Tagliatelle')).not.toContain('g-cipolla-aglio');
    expect(suggestGroups('Latte di mandorla')).not.toContain('g-lattosio');
    expect(suggestGroups('Pasta senza glutine')).not.toContain('g-frumento');
    expect(suggestGroups('Birra analcolica')).not.toContain('g-alcol');
    expect(suggestGroups('Pollo alla griglia')).not.toContain('g-carne');
    expect(suggestGroups('Cotoletta di pollo')).not.toContain('g-carne');
    expect(suggestGroups('Carne alla pizzaiola')).not.toContain('g-frumento');
    expect(suggestGroups('Galletto')).not.toContain('g-frumento');
    expect(suggestGroups('Frutta a guscio')).toEqual(['g-guscio']);
    expect(suggestGroups('Fagiolini')).not.toContain('g-legumi');
    expect(suggestGroups('Spaghetti ai frutti di mare')).not.toContain('g-frutta-tutta');
    expect(suggestGroups('Dolcificanti (sorbitolo, xilitolo…)')).toEqual(['g-polioli']);
  });

  it('le bevande sono bevande, con ciò che contengono', () => {
    has('Birra', 'g-bevande', 'g-alcol', 'g-gassate');
    has('Cappuccino', 'g-bevande', 'g-caffeina', 'g-lattosio');
    expect(suggestGroups('Acqua naturale')).toEqual(['g-bevande']);
  });

  it('i gruppi scelti a mano vincono su quelli suggeriti', () => {
    expect(groupsOf({ name: 'Focaccia', groups: ['g-grassi'] })).toEqual(['g-grassi']);
    expect(groupsOf({ name: 'Focaccia' })).toEqual(['g-frumento']);
  });

  it('nel menù un cibo sta in un solo posto; se non lo capisce, sta in "da completare"', () => {
    expect(shelvesOf({ name: 'Pasta al ragù' })).toEqual(['g-frumento']);
    expect(shelvesOf({ name: 'Birra' })).toEqual(['g-bevande']);
    expect(shelvesOf({ name: 'Tiramisù' })).toEqual(['g-dolci']);
    expect(shelvesOf({ name: 'Frittata di zucchine' })).toEqual(['g-uova']);
    expect(shelvesOf({ name: 'Mozzarella' })).toEqual(['g-lattosio']);
    expect(shelvesOf({ name: 'Kiwi' })).toEqual(['g-frutta-tutta']);
    expect(shelvesOf({ name: 'Xyzzy' })).toEqual(['altro']);
    expect(shelvesOf({ name: 'Piccante' })).toEqual(['altro']);
  });

  it('i cibi della lista iniziale sono quasi tutti riconosciuti', () => {
    const byName = new Map(DEFAULT_FOODS.map((f) => [f.name, groupsOf(f)]));
    expect(byName.get('Latte')).toEqual(['g-lattosio']);
    expect(byName.get('Cipolla')).toEqual(expect.arrayContaining(['g-cipolla-aglio']));
    expect(byName.get('Vino')).toEqual(['g-bevande', 'g-alcol']);
    expect(byName.get('Caffè')).toEqual(['g-bevande', 'g-caffeina']);
    expect(byName.get('Riso')).toEqual(['g-cereali']);
    const unknown = DEFAULT_FOODS.filter((f) => groupsOf(f).length === 0).map((f) => f.name);
    expect(unknown).toEqual(['Pasto abbondante']);
  });
});
