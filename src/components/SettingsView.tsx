import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayScore } from '../analysis';
import { todayISO } from '../date';
import { lastBackupAt, restoreSnapshot, saveBackup, snapshotInfo, takeSnapshot } from '../backup';
import { db, exportBackup, importBackup, replaceDays, wipeAll } from '../db';
import { FOOD_CATEGORIES, slugify } from '../defaults';
import { generateDemo } from '../demo';
import { LEVELS, MEALS, MOMENT_INFO, mealsOf } from '../day';
import { useFactorNames, useFoods, useSymptoms } from '../hooks';
import type { DayEntry, Moment } from '../types';
import { Icon, Mascot, Sec } from '../ui';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../install';

// Nella versione anteprima (pagina pubblicata) il browser blocca i download: copiamo negli appunti.
const CAN_DOWNLOAD = !import.meta.env.VITE_ARTIFACT;

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
  const [pending, setPending] = useState<'demo' | 'wipe' | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  // Forza il ricalcolo di ultimo backup e copia di sicurezza, che stanno fuori dal database.
  const [backupTick, setBackupTick] = useState(0);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const dayCount = useLiveQuery(() => db.days.count(), [], 0);
  const last = useMemo(() => lastBackupAt(), [backupTick]);
  const snapshot = useMemo(() => snapshotInfo(), [backupTick]);

  /** Scarica il file, oppure (in anteprima) lo copia negli appunti con un ripiego manuale. */
  const deliver = async (filename: string, content: string, type: string, what: string) => {
    setManualCopy(null);
    if (CAN_DOWNLOAD) {
      download(filename, content, type);
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      setMessage(`${what} copiato negli appunti. Incollalo in una nota o in un file per conservarlo.`);
    } catch {
      setMessage(`Copia automatica non riuscita: seleziona il testo qui sotto e copialo.`);
      setManualCopy(content);
    }
  };
  const [newFood, setNewFood] = useState('');
  const [newFoodCat, setNewFoodCat] = useState(FOOD_CATEGORIES[0]);
  const [newSymptom, setNewSymptom] = useState('');
  const [browseCat, setBrowseCat] = useState(FOOD_CATEGORIES[0]);

  const categories = [...new Set([...FOOD_CATEGORIES, ...foods.map((f) => f.category)])];

  const exportJson = async () => {
    setManualCopy(null);
    const { result, text } = await saveBackup();
    if (result === 'shared' || result === 'downloaded') setMessage('Backup salvato. Tienilo in un posto sicuro (iCloud Drive, Google Drive, email…).');
    else if (result === 'copied') setMessage('Backup copiato negli appunti. Incollalo in una nota o in un file per conservarlo.');
    else if (result === 'failed') {
      setMessage('Copia automatica non riuscita: seleziona il testo qui sotto e copialo.');
      setManualCopy(text ?? null);
    }
    setBackupTick((t) => t + 1);
  };

  // CSV con separatore ";" così si apre direttamente in Excel con impostazioni italiane.
  const exportCsv = async () => {
    const { days } = await exportBackup();
    const active = symptoms.filter((s) => !s.archived);
    const moment = (d: DayEntry, m: Moment) => {
      const log = d.moments?.[m];
      if (!log) return '';
      const names = log.symptoms.map((id) => symptoms.find((s) => s.id === id)?.name ?? id);
      return `${LEVELS[log.level].label}${names.length ? ` (${names.join(', ')})` : ''}`;
    };
    const header = [
      'data',
      ...MOMENT_INFO.map((m) => m.label),
      'media (0 bene - 4 malissimo)',
      'bristol',
      'stress',
      'sonno',
      ...MEALS.map((m) => m.label),
      'cena abbondante o tardiva',
      'note',
    ];
    const rows = days
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const meals = mealsOf(d);
        return [
          d.date,
          ...MOMENT_INFO.map((m) => moment(d, m.id)),
          dayScore(d, active.map((s) => s.id), { kind: 'overall' })?.toFixed(2).replace('.', ','),
          d.bristol === 0 ? 'nessuna' : d.bristol,
          d.stress,
          d.sleep,
          ...MEALS.map((m) => meals[m.id].map(nameOf).join(', ')),
          d.bigDinner ? 'sì' : '',
          d.notes,
        ];
      });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
    // Il BOM serve a Excel per leggere gli accenti; negli appunti non serve.
    await deliver(`gutty-diario-${todayISO()}.csv`, CAN_DOWNLOAD ? '\uFEFF' + csv : csv, 'text/csv;charset=utf-8', 'Diario in formato CSV');
  };

  const importText = async (text: string) => {
    try {
      const n = await importBackup(JSON.parse(text));
      setMessage(`Importate ${n} giornate.`);
      setPasteOpen(false);
      setPasteText('');
    } catch (e) {
      setMessage(e instanceof SyntaxError ? 'Il testo incollato non è un backup completo: copialo di nuovo per intero.' : e instanceof Error ? e.message : 'Importazione non riuscita.');
    }
  };

  const onImport = async (file: File) => {
    try {
      const n = await importBackup(JSON.parse(await file.text()));
      setMessage(`Importate ${n} giornate.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Importazione non riuscita.');
    }
  };

  // Le conferme sono nella pagina: i dialoghi del browser non sono disponibili ovunque.
  // Prima di sostituire o cancellare il diario ne teniamo una copia, per poter tornare indietro.
  const loadDemo = async () => {
    setPending(null);
    await takeSnapshot();
    await replaceDays(generateDemo());
    setMessage('Caricati 120 giorni di esempio. I tuoi dati di prima si possono ripristinare qui sopra.');
    setBackupTick((t) => t + 1);
  };

  const wipe = async () => {
    setPending(null);
    await takeSnapshot();
    await wipeAll();
    setMessage('Dati cancellati. Se è stato un errore, puoi ripristinarli qui sopra.');
    setBackupTick((t) => t + 1);
  };

  const restore = async () => {
    const n = await restoreSnapshot();
    setMessage(`Ripristinate ${n} giornate.`);
    setBackupTick((t) => t + 1);
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
        <div className="kicker">Impostazioni</div>
        <h1>Il tuo spazio</h1>
        <p>I tuoi dati restano su questo dispositivo: niente account, niente server.</p>
      </header>

      {!import.meta.env.VITE_ARTIFACT && <InstallCard />}

      <Sec title="Dati" />
      <section className={`data-status${!last && dayCount > 0 ? ' warn' : ''}`}>
        <strong>
          {dayCount} {dayCount === 1 ? 'giornata salvata' : 'giornate salvate'} su questo telefono
        </strong>
        <span>
          {last
            ? `Ultimo backup: ${last.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`
            : dayCount > 0
              ? 'Nessun backup ancora: salvane uno, così i dati sono al sicuro anche se il telefono li cancella.'
              : 'Quando inizi a scrivere, ricordati di salvare ogni tanto un backup.'}
        </span>
      </section>
      {snapshot && (
        <section className="note" style={{ marginTop: 12 }}>
          Hai una copia dei dati di prima dell’ultima sostituzione o cancellazione ({snapshot.days} giornate).
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => void restore()}>
              Ripristina i dati di prima
            </button>
          </div>
        </section>
      )}
      <section className="sheet flush" style={{ marginTop: 12 }}>
        <ul className="list">
          <li>
            <button className="list-action" onClick={exportJson}>
              <span className="ico">
                <Icon name="download" />
              </span>
              <span>
                Salva backup
                <span className="hint">
                  {CAN_DOWNLOAD
                    ? 'Un file da tenere su iCloud Drive, Google Drive o email: con “Importa” ritrovi tutto'
                    : 'Copia i dati negli appunti, per conservarli o spostarli'}
                </span>
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
            <button className="list-action" onClick={() => setPasteOpen((v) => !v)}>
              <span className="ico">
                <Icon name="paste" />
              </span>
              <span>
                Incolla backup
                <span className="hint">Se il backup è negli appunti, per esempio copiato dall’anteprima</span>
              </span>
            </button>
          </li>
          {pasteOpen && (
            <li className="paste-row">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void importText(pasteText);
                }}
              >
                <label className="sr-only" htmlFor="paste-backup">
                  Testo del backup
                </label>
                <textarea
                  id="paste-backup"
                  className="field"
                  placeholder="Tieni premuto qui e scegli Incolla"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button className="btn" type="submit" disabled={!pasteText.trim()}>
                    Importa
                  </button>
                  <button className="btn link" type="button" onClick={() => setPasteOpen(false)}>
                    Annulla
                  </button>
                </div>
              </form>
            </li>
          )}
          <li>
            <button className="list-action" onClick={exportCsv}>
              <span className="ico">
                <Icon name="table" />
              </span>
              <span>
                Esporta per Excel
                <span className="hint">
                  {CAN_DOWNLOAD ? 'CSV da portare al medico o analizzare a modo tuo' : 'Copia il diario in formato tabella, da incollare in Excel'}
                </span>
              </span>
            </button>
          </li>
          <li>
            <button className="list-action" onClick={() => setPending('demo')}>
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
            <button className="list-action danger" onClick={() => setPending('wipe')}>
              <span className="ico">
                <Icon name="trash" />
              </span>
              <span>Cancella tutti i dati</span>
            </button>
          </li>
        </ul>
      </section>
      {pending && (
        <div className="note" role="alertdialog" aria-live="assertive" style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 12px' }}>
            {pending === 'demo'
              ? 'I dati di esempio sostituiscono il diario attuale. Se hai già dei dati, esporta prima un backup.'
              : 'Vuoi cancellare tutti i dati da questo dispositivo? Non si può annullare.'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={pending === 'wipe' ? { background: 'var(--danger)' } : undefined}
              onClick={() => void (pending === 'demo' ? loadDemo() : wipe())}
            >
              {pending === 'demo' ? 'Carica esempio' : 'Cancella tutto'}
            </button>
            <button className="btn link" onClick={() => setPending(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {message && !pending && (
        <p className="note" role="status" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
      {manualCopy && (
        <textarea
          id="manual-copy"
          className="field"
          readOnly
          value={manualCopy}
          style={{ marginTop: 8, minHeight: 140, fontSize: '0.8rem' }}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}

      <Sec title="Sintomi" aside="scegli cosa seguire" />
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

      <Sec title="Alimenti" aside={`${foods.filter((f) => !f.archived).length} attivi`} />
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
        <Mascot face="happy" size={48} still />
        Gutty · il tuo diario della pancia
        <br />
        Non sostituisce il parere del medico.
      </footer>
    </>
  );
}

/** Invito a installare l'app sul telefono; sparisce quando è già installata. */
function InstallCard() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall);
  const [done, setDone] = useState(false);
  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), []);

  if (isStandalone() || done) return null;

  return (
    <>
      <Sec title="Installa sul telefono" />
      <section className="sheet install">
        <Mascot face="happy" size={56} still />
        <div>
          <p>Aggiungila alla schermata Home: si apre come un’app, a schermo intero, e funziona anche offline.</p>
          {canPrompt ? (
            <button className="btn" onClick={() => void promptInstall().then((ok) => ok && setDone(true))}>
              Installa Gutty
            </button>
          ) : isIOS() ? (
            <ol>
              <li>
                Se hai già inserito dati qui, prima tocca <strong>Salva backup</strong> qui sotto: l’app sulla Home
                parte vuota e li ritrovi con <strong>Importa backup</strong>.
              </li>
              <li>
                Apri questa pagina con <strong>Safari</strong>.
              </li>
              <li>
                Tocca <strong>Condividi</strong> (il quadrato con la freccia in su).
              </li>
              <li>
                Scegli <strong>Aggiungi alla schermata Home</strong>.
              </li>
            </ol>
          ) : (
            <ol>
              <li>
                Apri il menu del browser (<strong>⋮</strong>).
              </li>
              <li>
                Scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong>.
              </li>
            </ol>
          )}
        </div>
      </section>
    </>
  );
}
