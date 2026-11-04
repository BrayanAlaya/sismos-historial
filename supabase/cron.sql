-- El programador de Supabase no admite segundos. Se lanza cada minuto
-- y esa ejecución revisa USGS una sola vez y envía las notificaciones nuevas.
-- Si ya existía el trabajo anterior:
--   select cron.unschedule('check-nearby-quakes');

select cron.schedule(
  'check-nearby-quakes',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://rhsdwxujrixouvywhpha.supabase.co/functions/v1/check-nearby-quakes',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
