import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { backupDue, restoreSnapshot, snapshotInfo, takeSnapshot } from './backup';
import Dexie from 'dexie';
import { analyze, dayScore } from './analysis';
import { db, exportBackup, importBackup, replaceDays, saveDay, wipeAll } from './db';
import { drinksOf, entriesByGroup, groupsOf } from './groups';
import { byDrinks } from './stats';
import { generateDemo } from './demo';
import type { DayEntry } from './types';

// localStorage minimale per l'ambiente di test (Node non ce l'ha).
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const mine: DayEntry[] = [
  { date: '2026-09-01', foods: ['latte'], symptoms: {}, moments: { sera: { level: 3, symptoms: ['gonfiore'] } }, updatedAt: 1 },
  { date: '2026-09-02', foods: ['pane'], symptoms: {}, moments: { mattina: { level: 0, symptoms: [] } }, updatedAt: 2 },
];

beforeEach(async () => {
  store.clear();
  await wipeAll();
});

describe('i dati sopravvivono agli aggiornamenti', () => {
  it('riaprendo il database (come fa una nuova versione dell’app) il diario c’è ancora', async () => {
    for (const d of mine) await saveDay(d);
    db.close();
    await db.open();
    expect((await db.days.toArray()).map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02']);
  });
});

describe('compatibilità con i diari già inseriti', () => {
  // Una giornata come la salvavano le versioni precedenti: niente bicchieri, cibi senza gruppi,
  // e persino i vecchi dettagli 0-10 senza momenti né pasti.
  const oldDays: DayEntry[] = [
    { date: '2026-08-01', foods: ['pane', 'vino'], symptoms: { dolore: 5 }, stress: 3, updatedAt: 1 },
    { date: '2026-08-02', foods: ['focaccia'], symptoms: {}, moments: { mattina: { level: 2, symptoms: ['gonfiore'] } }, updatedAt: 2 },
  ];
  const oldFoods = [
    { id: 'pane', name: 'Pane', category: 'Cereali e farinacei' },
    { id: 'vino', name: 'Vino', category: 'Bevande' },
    { id: 'focaccia', name: 'Focaccia', category: 'Altro' },
  ];

  it('apre il database scritto dalla versione precedente senza perdere nulla', async () => {
    db.close();
    // Lo stesso database "gutty" scritto da un'istanza separata, come farebbe la vecchia app.
    const old = new Dexie('gutty');
    old.version(1).stores({ days: 'date', foods: 'id, category', symptoms: 'id' });
    await old.open();
    await old.table('days').bulkPut(oldDays);
    await old.table('foods').bulkPut(oldFoods);
    old.close();

    await db.open();
    const days = await db.days.toArray();
    expect(days).toEqual(oldDays);
    const foods = await db.foods.bulkGet(['pane', 'vino', 'focaccia']);
    expect(foods).toEqual(oldFoods);

    // E la nuova versione sa usarli: gruppi dedotti dal nome, nessun bicchiere inventato.
    expect(groupsOf(foods[2]!)).toContain('g-frumento');
    const byId = new Map(foods.map((f) => [f!.id, f!]));
    expect(drinksOf(days[0], byId)).toBeUndefined(); // vino senza numero di bicchieri: non lo indoviniamo
    expect(drinksOf(days[1], byId)).toBe(0);
    expect(dayScore(days[0], ['dolore'], { kind: 'overall' })).toBe(2);
    expect(() => analyze(entriesByGroup(days, foods as never), { symptomIds: ['dolore', 'gonfiore'], target: { kind: 'overall' }, lag: { from: 0, to: 0, timed: true } })).not.toThrow();
    expect(byDrinks(days, days, ['dolore', 'gonfiore'], foods as never)).toHaveLength(6);
  });

  it('i nuovi campi si salvano e tornano anche dal backup', async () => {
    await db.foods.bulkPut(oldFoods);
    await saveDay({ ...oldDays[1], drinks: 3 });
    await db.foods.update('focaccia', { groups: ['g-frumento', 'g-grassi'] });
    const backup = await exportBackup();
    await wipeAll();
    await importBackup(backup);
    expect((await db.days.get('2026-08-02'))?.drinks).toBe(3);
    expect((await db.foods.get('focaccia'))?.groups).toEqual(['g-frumento', 'g-grassi']);
  });

  it('un backup fatto con la versione precedente si importa ancora', async () => {
    await importBackup({ app: 'gutty', version: 1, exportedAt: '2026-08-03T10:00:00Z', days: oldDays, foods: oldFoods, symptoms: [] } as never);
    expect((await db.days.toArray()).map((d) => d.date)).toEqual(['2026-08-01', '2026-08-02']);
  });
});

describe('copia di sicurezza', () => {
  it('dopo aver caricato i dati di esempio si torna esattamente ai propri dati', async () => {
    await db.days.bulkPut(mine);
    await takeSnapshot();
    await replaceDays(generateDemo(30, 1, '2026-09-30'));
    expect(await db.days.count()).toBe(30);

    expect(snapshotInfo()?.days).toBe(2);
    await restoreSnapshot();
    const back = await db.days.toArray();
    expect(back).toHaveLength(2);
    expect(back[0].moments?.sera?.symptoms).toEqual(['gonfiore']);
    expect(snapshotInfo()).toBeNull();
  });

  it('dopo "Cancella tutto" si possono ripristinare i dati', async () => {
    await db.days.bulkPut(mine);
    await takeSnapshot();
    await wipeAll();
    expect(await db.days.count()).toBe(0);
    await restoreSnapshot();
    expect(await db.days.count()).toBe(2);
  });

  it('un diario vuoto non sovrascrive una copia buona', async () => {
    await db.days.bulkPut(mine);
    await takeSnapshot();
    await wipeAll();
    await takeSnapshot();
    expect(snapshotInfo()?.days).toBe(2);
  });
});

describe('promemoria backup', () => {
  const now = Date.parse('2026-09-30T10:00:00Z');

  it('non disturba finché ci sono meno di tre giornate', () => {
    expect(backupDue(2, 7, now)).toBe(false);
  });

  it('compare se non c’è mai stato un backup o se è vecchio', () => {
    expect(backupDue(5, 7, now)).toBe(true);
    store.set('gutty:lastBackup', String(now - 8 * 86_400_000));
    expect(backupDue(5, 7, now)).toBe(true);
    store.set('gutty:lastBackup', String(now - 2 * 86_400_000));
    expect(backupDue(5, 7, now)).toBe(false);
  });

  it('"Più tardi" lo rimanda', () => {
    store.set('gutty:backupSnooze', String(now + 86_400_000));
    expect(backupDue(5, 7, now)).toBe(false);
  });
});
