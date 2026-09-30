import { useRef, useState } from 'react';
import { dayScore } from '../analysis';
import { todayISO } from '../date';
import { db, exportBackup, importBackup, replaceDays, wipeAll } from '../db';
import { FOOD_CATEGORIES, slugify } from '../defaults';
import { generateDemo } from '../demo';
import { useFactorNames, useFoods, useSymptoms } from '../hooks';
import { Icon, Sec } from '../ui';

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
  const [browseCat, setBrowseCat] = useState(FOOD_CATEGORIES[0]);

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
    setBrowseCat(newFoodCat);
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
      <header className="page-title">
        <span className="mono">Dati solo su questo dispositivo</span>
        <h1 className="xp">Setup</h1>
        <p>Niente account, niente server. Il backup lo tieni tu.</p>
      </header>

      <Sec n={1} title="Dati" />
      <section className="sheet flush">
        <ul className="list">
          <li>
            <button className="list-action" onClick={exportJson}>
              <span className="ico">
                <Icon name="download" />
              </span>
              <span>
                Esporta backup
                <span className="hint">File JSON da conservare o da importare su un altro dispositivo</span>
              </span>
            </button>
          </li>
          <li>
            <button className="list-action" onClick={() => fileRef.current?.click()}>
              <span className="ico">
                <Icon name="upload" />
              </span>
              <span>
                Importa backup
                <span className="hint">Unisce i dati: per ogni giorno vince la versione più recente</span>
              </span>
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
          </li>
          <li>
            <button className="list-action" onClick={exportCsv}>
              <span className="ico">
                <Icon name="table" />
              </span>
              <span>
                Esporta per Excel
                <span className="hint">CSV da portare al medico o analizzare a modo tuo</span>
              </span>
            </button>
          </li>
          <li>
            <button className="list-action" onClick={loadDemo}>
              <span className="ico">
                <Icon name="sparkle" />
              </span>
              <span>
                Carica dati di esempio
                <span className="hint">120 giorni finti per vedere come funziona l’analisi</span>
              </span>
            </button>
          </li>
          <li>
            <button className="list-action danger" onClick={wipe}>
              <span className="ico">
                <Icon name="trash" />
              </span>
              <span>Cancella tutti i dati</span>
            </button>
          </li>
        </ul>
      </section>
      {message && (
        <p className="note" role="status" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}

      <Sec n={2} title="Sintomi" aside="cosa monitorare" />
      <section className="sheet flush">
        <ul className="list">
          {symptoms.map((s) => (
            <li key={s.id} className={s.archived ? 'off' : ''}>
              <span className="name">{s.name}</span>
              <button
                className="switch"
                role="switch"
                aria-checked={!s.archived}
                aria-label={`Monitora ${s.name}`}
                onClick={() => db.symptoms.update(s.id, { archived: !s.archived })}
              />
            </li>
          ))}
          <li>
            <form
              style={{ display: 'flex', gap: 8, width: '100%', padding: '10px 0' }}
              onSubmit={(e) => {
                e.preventDefault();
                void addSymptom();
              }}
            >
              <label className="field" style={{ flex: 1 }}>
                <Icon name="plus" size={18} />
                <input placeholder="Nuovo sintomo, es. nausea" value={newSymptom} onChange={(e) => setNewSymptom(e.target.value)} />
              </label>
              {newSymptom.trim() && (
                <button className="btn primary" type="submit">
                  Aggiungi
                </button>
              )}
            </form>
          </li>
        </ul>
      </section>

      <Sec n={3} title="Alimenti" aside={`${foods.filter((f) => !f.archived).length} attivi`} />
      <section className="sheet">
        <form
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            void addFood();
          }}
        >
          <label className="field" style={{ flex: '1 1 180px' }}>
            <Icon name="plus" size={18} />
            <input placeholder="Nuovo alimento o bevanda" value={newFood} onChange={(e) => setNewFood(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '0 1 170px' }}>
            <span className="sr-only">Categoria</span>
            <select value={newFoodCat} onChange={(e) => setNewFoodCat(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {newFood.trim() && (
            <button className="btn primary" type="submit">
              Aggiungi
            </button>
          )}
        </form>
        <div className="pills" style={{ marginTop: 16 }} role="group" aria-label="Categoria">
          {categories.map((c) => (
            <button key={c} className="pill" aria-pressed={browseCat === c} onClick={() => setBrowseCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <ul className="list" style={{ marginTop: 6 }}>
          {foods
            .filter((f) => f.category === browseCat)
            .map((f) => (
              <li key={f.id} className={f.archived ? 'off' : ''}>
                <span className="name">{f.name}</span>
                <button
                  className="switch"
                  role="switch"
                  aria-checked={!f.archived}
                  aria-label={`Mostra ${f.name} nell’elenco`}
                  onClick={() => db.foods.update(f.id, { archived: !f.archived })}
                />
              </li>
            ))}
        </ul>
      </section>

      <footer className="colophon">
        <span>Gutty · diario ibs</span>
        <span>Non sostituisce il medico</span>
      </footer>
    </>
  );
}
