// Stampa la chiave pubblica delle notifiche (derivata dal secret GUTTY_PUSH_SEED) per la build dell'app.
// Senza secret non stampa nulla: l'app si costruisce lo stesso, con il promemoria non disponibile.
import { vapidFromSeed } from './push-crypto.mjs';

const seed = process.env.GUTTY_PUSH_SEED;
if (seed) console.log(`VITE_VAPID_PUBLIC_KEY=${vapidFromSeed(seed).publicKeyB64}`);
