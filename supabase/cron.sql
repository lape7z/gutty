-- Ogni 5 minuti chiede alla funzione di mandare i promemoria dovuti.
-- La funzione invia al massimo un promemoria al giorno per telefono, quindi le chiamate in più non fanno nulla.
-- Sostituire PROJECT_REF con il riferimento del progetto Supabase.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('gutty-promemoria') where exists (select 1 from cron.job where jobname = 'gutty-promemoria');
select cron.schedule(
  'gutty-promemoria',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://PROJECT_REF.supabase.co/functions/v1/gutty-push',
       body := '{"action":"send"}'::jsonb,
       headers := '{"Content-Type":"application/json"}'::jsonb
     ) $$
);
