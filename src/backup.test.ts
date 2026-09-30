import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { backupDue, restoreSnapshot, snapshotInfo, takeSnapshot } from './backup';
import { db, replaceDays, saveDay, wipeAll } from './db';
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
