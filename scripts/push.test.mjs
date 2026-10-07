import { createDecipheriv, createECDH, createPublicKey, createVerify, hkdfSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptRegistration } from '../src/push';
import { isDue, localNow } from './promemoria.mjs';
import { b64url, decryptRegistration, encryptPayload, fromB64url, subscriptionId, vapidAuthorization, vapidFromSeed } from './push-crypto.mjs';

const vapid = vapidFromSeed('un segreto di prova abbastanza lungo');
const reg = { endpoint: 'https://web.push.apple.com/QWERTY', keys: { p256dh: 'BPk', auth: 'aaa' }, time: '21:00', tz: 'Europe/Rome' };

describe('chiavi delle notifiche', () => {
  it('dallo stesso segreto escono sempre le stesse chiavi', () => {
    expect(vapidFromSeed('un segreto di prova abbastanza lungo').publicKeyB64).toBe(vapid.publicKeyB64);
    expect(vapidFromSeed('un altro segreto, diverso dal primo').publicKeyB64).not.toBe(vapid.publicKeyB64);
    expect(vapid.publicKey).toHaveLength(65);
    expect(() => vapidFromSeed('corto')).toThrow();
  });
});

describe('registrazione cifrata (app → GitHub)', () => {
  it('quello che cifra l’app lo legge solo chi ha il segreto', async () => {
    const code = await encryptRegistration(reg, vapid.publicKeyB64);
    expect(code).not.toContain('apple');
    expect(decryptRegistration(code, vapid)).toEqual(reg);
    expect(() => decryptRegistration(code, vapidFromSeed('un altro segreto, diverso dal primo'))).toThrow();
  });

  it('rifiuta codici manomessi o incompleti', async () => {
    const code = await encryptRegistration({ ...reg, time: '25:00' }, vapid.publicKeyB64);
    expect(() => decryptRegistration(code, vapid)).toThrow('Ora non valida');
    const raw = fromB64url(await encryptRegistration(reg, vapid.publicKeyB64));
    raw[raw.length - 1] ^= 1;
    expect(() => decryptRegistration(b64url(raw), vapid)).toThrow();
    expect(subscriptionId(reg.endpoint)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('notifica cifrata (RFC 8291) e firma VAPID (RFC 8292)', () => {
  it('il telefono riesce a decifrare il messaggio', () => {
    const ua = createECDH('prime256v1');
    const uaPublic = ua.generateKeys();
    const auth = randomBytes(16);
    const body = encryptPayload({ p256dh: b64url(uaPublic), auth: b64url(auth) }, '{"title":"Gutty"}');

    // Decifratura come la fa il telefono.
    const salt = body.subarray(0, 16);
    expect(body.readUInt32BE(16)).toBe(4096);
    const asPublic = body.subarray(21, 21 + body[20]);
    const shared = ua.computeSecret(asPublic);
    const ikm = Buffer.from(hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
    const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
    const data = body.subarray(21 + body[20]);
    const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(data.subarray(data.length - 16));
    const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
    expect(plain.subarray(0, -1).toString()).toBe('{"title":"Gutty"}');
    expect(plain[plain.length - 1]).toBe(2);
  });

  it('la firma VAPID è valida per il servizio push', () => {
    const header = vapidAuthorization('https://web.push.apple.com/abc', vapid, 'https://github.com/lape7z/gutty', Date.UTC(2026, 9, 7));
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    expect(k).toBe(vapid.publicKeyB64);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(fromB64url(c).toString())).toMatchObject({ aud: 'https://web.push.apple.com', sub: 'https://github.com/lape7z/gutty' });
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64url(vapid.publicKey.subarray(1, 33)), y: b64url(vapid.publicKey.subarray(33)) }, format: 'jwk' });
    expect(createVerify('SHA256').update(`${h}.${c}`).verify({ key, dsaEncoding: 'ieee-p1363' }, fromB64url(sig))).toBe(true);
  });
});

describe('quando parte il promemoria', () => {
  // 7 ottobre 2026, ora legale: Roma = UTC+2.
  const at = (hhmm) => new Date(`2026-10-07T${hhmm}:00Z`);

  it('usa l’ora del telefono, anche con l’ora legale', () => {
    expect(localNow('Europe/Rome', at('19:00'))).toEqual({ date: '2026-10-07', minutes: 21 * 60 });
    expect(localNow('Europe/Rome', new Date('2026-12-07T20:00:00Z')).minutes).toBe(21 * 60);
  });

  it('parte dall’ora scelta, una volta sola, e non a notte fonda', () => {
    expect(isDue(reg, undefined, at('18:55'))).toBeNull(); // 20:55
    expect(isDue(reg, undefined, at('19:04'))).toBe('2026-10-07'); // 21:04
    expect(isDue(reg, '2026-10-07', at('19:19'))).toBeNull(); // già inviato oggi
    expect(isDue(reg, '2026-10-06', at('20:30'))).toBe('2026-10-07'); // GitHub in ritardo: parte lo stesso
    expect(isDue(reg, '2026-10-06', at('22:05'))).toBeNull(); // 00:05 del giorno dopo: troppo tardi
  });
});
