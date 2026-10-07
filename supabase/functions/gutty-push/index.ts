// Promemoria serale di Gutty: registra i telefoni e manda la notifica all'ora scelta.
// Azioni (POST JSON, tranne "key"):
//   GET  ?action=key                                   → chiave pubblica VAPID
//   subscribe   { subscription, remindAt, tz }         → attiva o aggiorna
//   unsubscribe { endpoint }                           → disattiva
//   filled      { endpoint, date }                     → oggi è già compilata: niente promemoria
//   send                                               → chiamata dal cron ogni 5 minuti
import postgres from 'npm:postgres@3.4.5';
import webpush from 'npm:web-push@3.6.7';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });
const SUBJECT = 'https://lape7z.github.io/gutty/';
/** Se il cron si ferma per un po', non mandare il promemoria della sera a notte fonda. */
const WINDOW_MIN = 180;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function vapidKeys(): Promise<{ public_key: string; private_key: string }> {
  const [row] = await sql`select public_key, private_key from gutty.push_config where id = 1`;
  if (row) return row as { public_key: string; private_key: string };
  const keys = webpush.generateVAPIDKeys();
  await sql`insert into gutty.push_config (id, public_key, private_key) values (1, ${keys.publicKey}, ${keys.privateKey}) on conflict (id) do nothing`;
  const [saved] = await sql`select public_key, private_key from gutty.push_config where id = 1`;
  return saved as { public_key: string; private_key: string };
}

/** Data (YYYY-MM-DD) e minuti dalla mezzanotte nel fuso orario del telefono. */
function localNow(tz: string): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  } catch {
    return localNow('Europe/Rome');
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function validTime(t: unknown): string | null {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
}

function validTz(tz: unknown): string {
  if (typeof tz !== 'string') return 'Europe/Rome';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'Europe/Rome';
  }
}

async function send(): Promise<{ sent: number; removed: number }> {
  const keys = await vapidKeys();
  const subs = await sql`select endpoint, p256dh, auth, to_char(remind_at, 'HH24:MI') as remind_at, tz, last_sent::text as last_sent, last_filled::text as last_filled from gutty.push_subscriptions`;
  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    const { date, minutes } = localNow(s.tz);
    const [h, m] = (s.remind_at as string).split(':').map(Number);
    const due = minutes >= h * 60 + m && minutes < h * 60 + m + WINDOW_MIN;
    if (!due || s.last_sent === date || s.last_filled === date) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: 'Gutty', body: 'Com’è andata oggi? Bastano pochi tocchi per segnare pasti e sintomi.' }),
        { vapidDetails: { subject: SUBJECT, publicKey: keys.public_key, privateKey: keys.private_key }, TTL: WINDOW_MIN * 60, urgency: 'normal' },
      );
      await sql`update gutty.push_subscriptions set last_sent = ${date} where endpoint = ${s.endpoint}`;
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410: il telefono ha revocato il permesso o l'app è stata rimossa.
      if (status === 404 || status === 410) {
        await sql`delete from gutty.push_subscriptions where endpoint = ${s.endpoint}`;
        removed++;
      } else {
        console.error('push fallito', status, (e as Error).message);
      }
    }
  }
  return { sent, removed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('action') === 'key') {
      return json({ publicKey: (await vapidKeys()).public_key });
    }
    if (req.method !== 'POST') return json({ error: 'metodo non supportato' }, 405);
    const body = await req.json().catch(() => ({}));

    switch (body.action) {
      case 'subscribe': {
        const sub = body.subscription;
        const time = validTime(body.remindAt);
        if (typeof sub?.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || typeof sub?.keys?.p256dh !== 'string' || typeof sub?.keys?.auth !== 'string' || !time) {
          return json({ error: 'dati non validi' }, 400);
        }
        const tz = validTz(body.tz);
        await sql`
          insert into gutty.push_subscriptions (endpoint, p256dh, auth, remind_at, tz)
          values (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${time}, ${tz})
          on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
            remind_at = excluded.remind_at, tz = excluded.tz, updated_at = now()`;
        return json({ ok: true });
      }
      case 'unsubscribe': {
        if (typeof body.endpoint !== 'string') return json({ error: 'dati non validi' }, 400);
        await sql`delete from gutty.push_subscriptions where endpoint = ${body.endpoint}`;
        return json({ ok: true });
      }
      case 'filled': {
        if (typeof body.endpoint !== 'string' || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          return json({ error: 'dati non validi' }, 400);
        }
        await sql`update gutty.push_subscriptions set last_filled = ${body.date} where endpoint = ${body.endpoint}`;
        return json({ ok: true });
      }
      case 'send':
        return json(await send());
      default:
        return json({ error: 'azione sconosciuta' }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'errore interno' }, 500);
  }
});
