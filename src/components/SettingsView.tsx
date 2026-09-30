import { useRef, useState } from 'react';
import { dayScore } from '../analysis';
import { todayISO } from '../date';
import { db, exportBackup, importBackup, replaceDays, wipeAll } from '../db';
import { FOOD_CATEGORIES, slugify } from '../defaults';
import { generateDemo } from '../demo';
import { useFactorNames, useFoods, useSymptoms } from '../hooks';

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SettingsView() {
  const foods = useFoods();
  const symptoms = useSymptoms();
  const nameOf = useFactorNames();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newFood, setNewFood] = useState('');
  const [newFoodCat, setNewFoodCat] = useState(FOOD_CATEGORIES[0]);
  const [newSymptom, setNewSymptom] = useState('');

  const categories = [...new Set([...FOOD_CATEGORIES, ...foods.map((f) => f.category)])];

  const exportJson = async () => {
    const backup = await exportBackup();
    download(`gutty-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };

  // CSV con separatore ";" così si apre direttamente in Excel con impostazioni italiane.
  const exportCsv = async () => {
    const { days } = await exportBackup();
    const active = symptoms.filter((s) => !s.archived);
    const header = ['data', ...active.map((s) => s.name), 'media sintomi', 'bristol', 'stress', 'sonno', 'alimenti', 'note'];
    const rows = days
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => [
        d.date,
        ...active.map((s) => d.symptoms[s.id] ?? 0),
        dayScore(d, active.map((s) => s.id), { kind: 'overall' })?.toFixed(2).replace('.', ','),
        d.bristol,
        d.stress,
        d.sleep,
        d.foods.map(nameOf).join(', '),
        d.notes,
      ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
    download(`gutty-diario-${todayISO()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  };

  const onImport = async (file: File) => {
    try {
      const n = await importBackup(JSON.parse(await file.text()));
      setMessage(`Importate ${n} giornate.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Importazione non riuscita.');
    }
  };

  const loadDemo = async () => {
    if (!confirm('I dati di esempio sostituiscono il diario attuale. Esporta prima un backup se hai già dei dati. Continuare?')) return;
    await replaceDays(generateDemo());
    setMessage('Caricati 120 giorni di esempio. Trigger nascosti: cipolla (giorno dopo), latte (stesso giorno), stress alto.');
  };

  const wipe = async () => {
    if (!confirm('Cancellare TUTTI i dati dal dispositivo? L’operazione non si può annullare.')) return;
    await wipeAll();
    setMessage('Dati cancellati.');
  };

  const addFood = async () => {
    const name = newFood.trim();
    if (!name) return;
    const id = slugify(name) || `alimento-${Date.now()}`;
    if (await db.foods.get(id)) {
      await db.foods.update(id, { archived: false, category: newFoodCat });
    } else {
      await db.foods.add({ id, name, category: newFoodCat });
    }
    setNewFood('');
  };

  const addSymptom = async () => {
    const name = newSymptom.trim();
    if (!name) return;
    const id = slugify(name) || `sintomo-${Date.now()}`;
    await db.symptoms.put({ id, name });
    setNewSymptom('');
  };

  return (
    <>
      <section className="card">
        <h2>I tuoi dati</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Tutto resta su questo dispositivo, nel browser: niente account, niente server. Per spostare i dati su un altro
          dispositivo o conservarli al sicuro, esporta un backup e reimportalo.
        </p>
        <div className="row">
          <button className="btn" onClick={exportJson}>
            Esporta backup (JSON)
          </button>
          <button className="btn" onClick={exportCsv}>
            Esporta per Excel (CSV)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importa backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={loadDemo}>
            Carica dati di esempio
          </button>
          <button className="btn danger" onClick={wipe}>
            Cancella tutto
          </button>
        </div>
        {message && (
          <p className="notice" role="status" style={{ marginBottom: 0 }}>
            {message}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Sintomi monitorati</h2>
        <ul className="settings-list">
          {symptoms.map((s) => (
            <li key={s.id} className={s.archived ? 'archived' : ''}>
              <span className="name">{s.name}</span>
              <button className="btn ghost small" onClick={() => db.symptoms.update(s.id, { archived: !s.archived })}>
                {s.archived ? 'Ripristina' : 'Nascondi'}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          style={{ flexWrap: 'nowrap', marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            void addSymptom();
          }}
        >
          <input type="text" placeholder="Nuovo sintomo (es. nausea)" value={newSymptom} onChange={(e) => setNewSymptom(e.target.value)} />
          <button className="btn primary" type="submit">
            Aggiungi
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Alimenti e bevande</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addFood();
          }}
        >
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input type="text" placeholder="Nuovo alimento" value={newFood} onChange={(e) => setNewFood(e.target.value)} />
            <select value={newFoodCat} onChange={(e) => setNewFoodCat(e.target.value)} style={{ maxWidth: 160 }} aria-label="Categoria">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className="btn primary" type="submit">
              Aggiungi
            </button>
          </div>
        </form>
        {categories.map((cat) => {
          const items = foods.filter((f) => f.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <h3>{cat}</h3>
              <ul className="settings-list">
                {items.map((f) => (
                  <li key={f.id} className={f.archived ? 'archived' : ''}>
                    <span className="name">{f.name}</span>
                    <button className="btn ghost small" onClick={() => db.foods.update(f.id, { archived: !f.archived })}>
                      {f.archived ? 'Ripristina' : 'Nascondi'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}
