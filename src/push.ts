import { isIOS, isStandalone } from './install';
import type { DayEntry } from './types';

// Promemoria serale con notifiche push, inviate dalla funzione Supabase "gutty-push".
// Al server arrivano solo l'indirizzo push del telefono, l'ora scelta e il fuso orario: nessun dato del diario.

/** Indirizzo della funzione; vuoto = promemoria non ancora configurato (la scheda non compare). */
export const PUSH_URL = '';

const STATE_KEY = 'gutty:reminder';
const FILLED_KEY = 'gutty:reminderFilled';
export const DEFAULT_TIME = '21:00';

export interface ReminderState {
  enabled: boolean;
  time: string;
}

export type PushSupport = 'ok' | 'needs-install' | 'unsupported' | 'denied';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Memoria del browser non disponibile: il promemoria funziona lo stesso, ma la scheda non lo ricorda.
  }
}

export function reminderState(): ReminderState {
  return read<ReminderState>(STATE_KEY, { enabled: false, time: DEFAULT_TIME });
}

export function pushSupport(): PushSupport {
  // L'anteprima in un solo file non ha service worker.
  if (import.meta.env.VITE_ARTIFACT) return 'unsupported';
  const capable = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // Su iPhone le notifiche esistono solo per l'app aggiunta alla schermata Home.
  if (!capable) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

async function call(body: unknown): Promise<void> {
  const res = await fetch(PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Errore del server (${res.status})`);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  const res = await fetch(`${PUSH_URL}?action=key`);
  if (!res.ok) throw new Error(`Errore del server (${res.status})`);
  const { publicKey } = (await res.json()) as { publicKey: string };
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
  } catch {
    return 'Europe/Rome';
  }
}

/** Chiede il permesso (va chiamata da un tocco) e attiva il promemoria all'ora indicata. */
export async function enableReminder(time: string): Promise<ReminderState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'denied' : 'Permesso non concesso.');
  const sub = await subscription(true);
  await call({ action: 'subscribe', subscription: sub!.toJSON(), remindAt: time, tz: timezone() });
  const state = { enabled: true, time };
  write(STATE_KEY, state);
  return state;
}

export async function disableReminder(): Promise<ReminderState> {
  const sub = await subscription(false);
  if (sub) {
    await call({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  const state = { enabled: false, time: reminderState().time };
  write(STATE_KEY, state);
  return state;
}

/** La giornata conta come compilata con almeno un alimento e i sintomi del pomeriggio. */
export function isFilled(entry: DayEntry): boolean {
  return entry.foods.length > 0 && !!entry.moments?.pomeriggio;
}

/** Avvisa il server che oggi non serve il promemoria (una volta al giorno, senza bloccare nulla). */
export function markFilled(entry: DayEntry, today: string): void {
  if (!PUSH_URL || entry.date !== today || !isFilled(entry) || !reminderState().enabled) return;
  if (read<string | null>(FILLED_KEY, null) === today || pushSupport() !== 'ok') return;
  void (async () => {
    const sub = await subscription(false);
    if (!sub) return;
    await call({ action: 'filled', endpoint: sub.endpoint, date: today });
    write(FILLED_KEY, today);
  })().catch(() => undefined);
}
