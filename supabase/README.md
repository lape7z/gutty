# Promemoria serale (Supabase)

Le notifiche del promemoria partono da una funzione Supabase. Il diario resta sul telefono:
al server arrivano solo l'indirizzo push del telefono, l'ora scelta e il fuso orario.

1. Applicare `migrations/20261007000000_gutty_push.sql` (schema privato `gutty`).
2. Pubblicare `functions/gutty-push` **senza verifica JWT** (`verify_jwt = false`): la chiamano l'app e il cron.
   Al primo avvio genera da sola le chiavi VAPID e le conserva in `gutty.push_config`.
3. Eseguire `cron.sql` sostituendo `PROJECT_REF`: ogni 5 minuti manda i promemoria dovuti.
4. In `src/push.ts` impostare `PUSH_URL = 'https://PROJECT_REF.supabase.co/functions/v1/gutty-push'`.
