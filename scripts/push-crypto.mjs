// Web Push senza dipendenze (RFC 8291 cifratura aes128gcm, RFC 8292 VAPID), con il solo modulo crypto di Node.
// Usato dal workflow "Promemoria serale": GitHub Actions fa da piccolo server per le notifiche.
import { createCipheriv, createDecipheriv, createECDH, createHash, createPrivateKey, createSign, hkdfSync, randomBytes } from 'node:crypto';

const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
/** Contesto della cifratura della registrazione (deve coincidere con src/push.ts). */
export const REGISTRATION_INFO = 'gutty-registrazione';

export const b64url = (buf) => Buffer.from(buf).toString('base64url');
export const fromB64url = (s) => Buffer.from(s, 'base64url');

/**
 * Chiavi VAPID ricavate da un segreto (il secret GUTTY_PUSH_SEED del repository):
 * stesse chiavi a ogni esecuzione, senza doverle conservare da nessuna parte.
 */
export function vapidFromSeed(seed) {
  if (!seed || seed.length < 16) throw new Error('GUTTY_PUSH_SEED mancante o troppo corto (almeno 16 caratteri).');
  for (let counter = 0; ; counter++) {
    const d = Buffer.from(hkdfSync('sha256', seed, 'gutty-vapid', `p256-${counter}`, 32));
    const n = BigInt(`0x${d.toString('hex')}`);
    if (n === 0n || n >= P256_ORDER) continue;
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(d);
    const pub = ecdh.getPublicKey();
    return { privateKey: d, publicKey: pub, publicKeyB64: b64url(pub) };
  }
}

function signingKey(vapid) {
  return createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: b64url(vapid.privateKey), x: b64url(vapid.publicKey.subarray(1, 33)), y: b64url(vapid.publicKey.subarray(33, 65)) },
    format: 'jwk',
  });
}

/** Intestazione Authorization VAPID per un endpoint push. */
export function vapidAuthorization(endpoint, vapid, subject, now = Date.now()) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const signature = createSign('SHA256').update(`${header}.${claims}`).sign({ key: signingKey(vapid), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${vapid.publicKeyB64}`;
}

/** Cifra il messaggio per l'abbonamento del telefono (un solo record aes128gcm). */
export function encryptPayload(keys, payload) {
  const uaPublic = fromB64url(keys.p256dh);
  const authSecret = fromB64url(keys.auth);
  const server = createECDH('prime256v1');
  const asPublic = server.generateKeys();
  const shared = server.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 = delimitatore dell'ultimo (e unico) record.
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** Manda una notifica. Restituisce lo stato HTTP (201 = consegnata, 404/410 = abbonamento non più valido). */
export async function sendPush(subscription, payload, vapid, subject, { ttl = 3 * 3600 } = {}) {
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(ttl),
      Urgency: 'normal',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: vapidAuthorization(subscription.endpoint, vapid, subject),
    },
    body: encryptPayload(subscription.keys, JSON.stringify(payload)),
  });
  return res.status;
}

/**
 * Decifra la registrazione creata dall'app (vedi encryptRegistration in src/push.ts):
 * versione (1) | chiave effimera (65) | salt (16) | iv (12) | testo cifrato + tag.
 */
export function decryptRegistration(code, vapid) {
  const raw = fromB64url(code.trim());
  if (raw[0] !== 1 || raw.length < 1 + 65 + 16 + 12 + 17) throw new Error('Codice di registrazione non valido.');
  const eph = raw.subarray(1, 66);
  const salt = raw.subarray(66, 82);
  const iv = raw.subarray(82, 94);
  const data = raw.subarray(94);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(vapid.privateKey);
  const key = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(eph), salt, REGISTRATION_INFO, 16));
  const decipher = createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
  const reg = JSON.parse(plain.toString('utf8'));
  if (typeof reg?.endpoint !== 'string' || !reg.endpoint.startsWith('https://') || typeof reg?.keys?.p256dh !== 'string' || typeof reg?.keys?.auth !== 'string') {
    throw new Error('Registrazione incompleta.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reg.time)) throw new Error('Ora non valida.');
  return reg;
}

/** Identificativo breve e anonimo di un telefono (dall'endpoint push). */
export function subscriptionId(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}
