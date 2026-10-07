-- Promemoria serale di Gutty (notifiche push).
-- Nessun dato del diario arriva qui: solo l'indirizzo push del telefono, l'ora scelta e il fuso orario.
-- Lo schema "gutty" non è esposto dalle API pubbliche: ci accede solo la funzione gutty-push.

create schema if not exists gutty;
revoke all on schema gutty from anon, authenticated;

create table if not exists gutty.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  -- Ora del promemoria e fuso orario del telefono, per mandarlo all'ora locale giusta.
  remind_at time not null default '21:00',
  tz text not null default 'Europe/Rome',
  -- Ultimo giorno (locale) in cui è partito il promemoria e in cui la giornata risultava già compilata.
  last_sent date,
  last_filled date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chiavi VAPID generate dalla funzione al primo avvio: la chiave privata non esce mai da qui.
create table if not exists gutty.push_config (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null
);

alter table gutty.push_subscriptions enable row level security;
alter table gutty.push_config enable row level security;
