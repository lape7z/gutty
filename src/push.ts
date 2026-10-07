import { isIOS, isStandalone } from './install';

// Promemoria serale con notifiche push. Le manda GitHub (workflow "Promemoria serale" del repository):
// il telefono si registra aprendo una issue con un codice cifrato, leggibile solo dal workflow.
// Al server arrivano solo l'indirizzo push del telefono, l'ora scelta e il fuso orario: nessun dato del diario.

/** Chiave pubblica delle notifiche, aggiunta dalla build; vuota = promemoria non disponibile. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
export const REPO = 'lape7z/gutty';
/** Deve coincidere con REGISTRATION_INFO in scripts/push-crypto.mjs. */
const REGISTRATION_INFO = 'gutty-registrazione';

const STATE_KEY = 'gutty:reminder';
export const DEFAULT_TIME = '21:00';

export interface ReminderState {
  /** 'off' = spento, 'pending' = permesso dato ma telefono non ancora registrato, 'on' = registrato. */
  status: 'off' | 'pending' | 'on';
  time: string;
}

export type PushSupport = 'ok' | 'needs-install' | 'unsupported' | 'denied';

export function reminderState(): ReminderState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ReminderState>) : {};
    return { status: parsed.status ?? 'off', time: parsed.time ?? DEFAULT_TIME };
  } catch {
    return { status: 'off', time: DEFAULT_TIME };
  }
}

export function saveReminderState(state: ReminderState): ReminderState {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Memoria del browser non disponibile: il promemoria funziona lo stesso, la scheda non lo ricorda.
  }
  return state;
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

export function b64urlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface Registration {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  time: string;
  tz: string;
}

/**
 * Cifra la registrazione con la chiave pubblica delle notifiche (ECDH P-256 + HKDF + AES-GCM),
 * così nella issue pubblica non compare l'indirizzo del telefono.
 * Formato: versione (1) | chiave effimera (65) | salt (16) | iv (12) | testo cifrato + tag.
 */
export async function encryptRegistration(reg: Registration, publicKey = VAPID_PUBLIC_KEY): Promise<string> {
  const subtle = crypto.subtle;
  const server = await subtle.importKey('raw', b64urlToBytes(publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: server }, eph.privateKey, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const hkdf = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(REGISTRATION_INFO) },
    hkdf,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt'],
  );
  const data = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(reg))));
  const ephRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  const out = new Uint8Array(1 + ephRaw.length + salt.length + iv.length + data.length);
  out.set([1], 0);
  out.set(ephRaw, 1);
  out.set(salt, 66);
  out.set(iv, 82);
  out.set(data, 94);
  return bytesToB64url(out);
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
  } catch {
    return 'Europe/Rome';
  }
}

/** Indirizzo della issue già compilata che registra il telefono: basta toccare "Create". */
export function registrationUrl(code: string, time: string): string {
  const body = [
    `Registrazione del promemoria serale di Gutty alle ${time}.`,
    'Il codice è cifrato: lo legge solo il promemoria. Tocca **Create** per attivarlo.',
    '',
    '```gutty',
    code,
    '```',
  ].join('\n');
  const params = new URLSearchParams({ title: `Promemoria Gutty ${time}`, body });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/**
 * Chiede il permesso (va chiamata da un tocco), crea l'abbonamento push e prepara il codice
 * di registrazione da mandare a GitHub.
 */
export async function prepareReminder(time: string): Promise<{ code: string; url: string }> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'denied' : 'Permesso non concesso.');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const code = await encryptRegistration({ endpoint: sub.endpoint, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth }, time, tz: timezone() });
  saveReminderState({ status: 'pending', time });
  return { code, url: registrationUrl(code, time) };
}

/** Spegne il promemoria: senza abbonamento, GitHub riceve un errore e lo cancella da solo. */
export async function disableReminder(): Promise<ReminderState> {
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch {
    // Niente da annullare.
  }
  return saveReminderState({ status: 'off', time: reminderState().time });
}
