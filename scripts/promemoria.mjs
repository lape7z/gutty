// Promemoria serale di Gutty, eseguito da GitHub Actions (.github/workflows/promemoria.yml).
//   node scripts/promemoria.mjs registra <file evento>   → nuova registrazione da una issue
//   node scripts/promemoria.mjs invia                    → manda i promemoria dovuti (ogni 15 minuti)
//   node scripts/promemoria.mjs prova                    → manda subito una notifica di prova a tutti
// Lo stato (registrazioni cifrate e ultimo invio) vive in stato/stato.json, sul branch "promemoria-stato".
// Al server non arriva nessun dato del diario: solo l'indirizzo push del telefono, l'ora e il fuso orario, cifrati.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { decryptRegistration, sendPush, subscriptionId, vapidFromSeed } from './push-crypto.mjs';

const STATE_FILE = 'stato/stato.json';
const SUBJECT = 'https://github.com/lape7z/gutty';
/** Se GitHub ritarda o salta qualche esecuzione, il promemoria parte comunque, ma non a notte fonda. */
const WINDOW_MIN = 180;

function loadState() {
  if (!existsSync(STATE_FILE)) return { iscrizioni: [], inviati: {} };
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

/** Data (YYYY-MM-DD) e minuti dalla mezzanotte nel fuso orario del telefono. */
export function localNow(tz, now = new Date()) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    return localNow('Europe/Rome', now);
  }
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** È il momento di mandare il promemoria? */
export function isDue(reg, lastSent, now = new Date()) {
  const { date, minutes } = localNow(reg.tz || 'Europe/Rome', now);
  const [h, m] = reg.time.split(':').map(Number);
  const at = h * 60 + m;
  return lastSent !== date && minutes >= at && minutes < at + WINDOW_MIN ? date : null;
}

function readRegistration(state, entry, vapid) {
  try {
    return decryptRegistration(entry.codice, vapid);
  } catch (e) {
    console.log(`Registrazione ${entry.id} illeggibile: ${e.message}`);
    return null;
  }
}

async function deliver(state, entry, reg, payload) {
  const status = await sendPush(reg, payload, vapidFromSeed(process.env.GUTTY_PUSH_SEED), SUBJECT);
  if (status === 404 || status === 410) {
    // Il telefono ha tolto il permesso o l'app è stata rimossa: non serve più.
    state.iscrizioni = state.iscrizioni.filter((s) => s.id !== entry.id);
    delete state.inviati[entry.id];
    console.log(`${entry.id}: abbonamento scaduto (${status}), rimosso.`);
    return false;
  }
  if (status >= 400) throw new Error(`${entry.id}: il servizio push ha risposto ${status}`);
  console.log(`${entry.id}: inviato (${status}).`);
  return true;
}

async function register(eventPath) {
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const issue = event.issue;
  // Solo chi gestisce il repository può registrare un telefono.
  if (!['OWNER', 'MEMBER', 'COLLABORATOR'].includes(issue.author_association)) {
    console.log('Issue di un utente esterno: ignorata.');
    return { message: null };
  }
  const code = /```gutty\s+([A-Za-z0-9_-]+)\s+```/.exec(issue.body ?? '')?.[1];
  if (!code) return { message: 'Non trovo il codice di registrazione nella issue.' };
  const vapid = vapidFromSeed(process.env.GUTTY_PUSH_SEED);
  let reg;
  try {
    reg = decryptRegistration(code, vapid);
  } catch (e) {
    return { message: `Registrazione non valida (${e.message}). Riprova dall'app: Impostazioni → Promemoria serale.` };
  }
  const state = loadState();
  const id = subscriptionId(reg.endpoint);
  state.iscrizioni = [...state.iscrizioni.filter((s) => s.id !== id), { id, codice: code, registrata: new Date().toISOString() }];
  let ok = false;
  try {
    ok = await deliver(state, { id }, reg, { title: 'Promemoria attivo ✓', body: `Ti avviserò ogni giorno alle ${reg.time}. Tocca per aprire Gutty.` });
  } catch (e) {
    // La registrazione resta valida: la notifica di prova riproverà la sera.
    console.log(e.message);
    ok = true;
  }
  saveState(state);
  return {
    message: ok
      ? `Fatto ✅ Promemoria attivo ogni giorno alle ${reg.time} (${reg.tz}). Sul telefono è appena arrivata una notifica di prova.`
      : 'Registrazione ricevuta, ma il telefono non accetta le notifiche: riattiva il promemoria dall’app.',
  };
}

async function sendDue({ test = false } = {}) {
  const state = loadState();
  const vapid = vapidFromSeed(process.env.GUTTY_PUSH_SEED);
  for (const entry of [...state.iscrizioni]) {
    const reg = readRegistration(state, entry, vapid);
    if (!reg) continue;
    const date = test ? localNow(reg.tz).date : isDue(reg, state.inviati[entry.id]);
    if (!date) continue;
    const payload = test
      ? { title: 'Gutty', body: 'Notifica di prova: se la vedi, il promemoria funziona.' }
      : { title: 'Gutty', body: 'Com’è andata oggi? Bastano pochi tocchi per segnare pasti e sintomi.' };
    try {
      if ((await deliver(state, entry, reg, payload)) && !test) state.inviati[entry.id] = date;
    } catch (e) {
      console.log(e.message);
    }
  }
  saveState(state);
}

const [mode, arg] = process.argv.slice(2);
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isMain) {
  // Importato dai test: niente da eseguire.
} else if (mode === 'registra') {
  const { message } = await register(arg);
  if (message) writeFileSync('risposta.md', message);
} else if (mode === 'invia') {
  await sendDue();
} else if (mode === 'prova') {
  await sendDue({ test: true });
} else {
  console.error(`Modalità sconosciuta: ${mode}`);
  process.exit(1);
}
