
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('simples-nacional-monthly-sync');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

-- 23:59 BRT (UTC-3) = 02:59 UTC do dia 21
SELECT cron.schedule(
  'simples-nacional-monthly-sync',
  '59 2 21 * *',
  $$
  SELECT net.http_post(
    url := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/simples-nacional-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo'
    ),
    body := jsonb_build_object('source', 'cron-monthly-day20-bst')
  ) AS request_id;
  $$
);
