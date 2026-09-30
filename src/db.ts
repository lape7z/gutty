import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_FOODS, DEFAULT_SYMPTOMS } from './defaults';
import type { DayEntry, Food, Symptom } from './types';

// Tutti i dati restano nel browser (IndexedDB): nessun server, nessun account.
// IMPORTANTE per gli aggiornamenti: non cambiare il nome del database né rimuovere tabelle.
// Per modificare lo schema aggiungi db.version(N + 1).stores(...).upgrade(...): Dexie migra i dati
// esistenti e le nuove versioni dell'app ritrovano tutto il diario.
export const db = new Dexie('gutty') as Dexie & {
  days: EntityTable<DayEntry, 'date'>;
  foods: EntityTable<Food, 'id'>;
  symptoms: EntityTable<Symptom, 'id'>;
};

db.version(1).stores({
  days: 'date',
  foods: 'id, category',
  symptoms: 'id',
});

db.on('populate', async (tx) => {
  await tx.table('foods').bulkAdd(DEFAULT_FOODS);
  await tx.table('symptoms').bulkAdd(DEFAULT_SYMPTOMS);
});

export function emptyDay(date: string): DayEntry {
  return { date, symptoms: {}, foods: [], updatedAt: 0 };
}

export async function saveDay(entry: DayEntry): Promise<void> {
  await db.days.put({ ...entry, updatedAt: Date.now() });
}

export interface Backup {
  app: 'gutty';
  version: 1;
  exportedAt: string;
  days: DayEntry[];
  foods: Food[];
  symptoms: Symptom[];
}

export async function exportBackup(): Promise<Backup> {
  const [days, foods, symptoms] = await Promise.all([db.days.toArray(), db.foods.toArray(), db.symptoms.toArray()]);
  return { app: 'gutty', version: 1, exportedAt: new Date().toISOString(), days, foods, symptoms };
}

/** Importa un backup unendolo ai dati esistenti: a parità di data vince la versione modificata più di recente. */
export async function importBackup(data: unknown): Promise<number> {
  const b = data as Partial<Backup>;
  if (b?.app !== 'gutty' || !Array.isArray(b.days)) throw new Error('File non valido: non è un backup di Gutty.');
  let imported = 0;
  await db.transaction('rw', db.days, db.foods, db.symptoms, async () => {
    if (Array.isArray(b.foods)) await db.foods.bulkPut(b.foods);
    if (Array.isArray(b.symptoms)) await db.symptoms.bulkPut(b.symptoms);
    for (const day of b.days!) {
      const existing = await db.days.get(day.date);
      if (!existing || (day.updatedAt ?? 0) >= existing.updatedAt) {
        await db.days.put(day);
        imported++;
      }
    }
  });
  return imported;
}

export async function replaceDays(days: DayEntry[]): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    await db.days.clear();
    await db.days.bulkPut(days);
  });
}

/** Sostituisce l'intero diario con un backup (usato per annullare una sostituzione o una cancellazione). */
export async function restoreBackup(b: Backup): Promise<void> {
  await db.transaction('rw', db.days, db.foods, db.symptoms, async () => {
    await db.days.clear();
    await db.days.bulkPut(b.days);
    if (b.foods?.length) {
      await db.foods.clear();
      await db.foods.bulkPut(b.foods);
    }
    if (b.symptoms?.length) {
      await db.symptoms.clear();
      await db.symptoms.bulkPut(b.symptoms);
    }
  });
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.days, db.foods, db.symptoms, async () => {
    await db.days.clear();
    await db.foods.clear();
    await db.symptoms.clear();
    await db.foods.bulkAdd(DEFAULT_FOODS);
    await db.symptoms.bulkAdd(DEFAULT_SYMPTOMS);
  });
}
