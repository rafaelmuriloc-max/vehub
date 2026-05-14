CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir
SELECT cron.unschedule('daily-cs-reminder-17h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cs-reminder-17h');

-- 17:00 America/Sao_Paulo (UTC-3, sem horário de verão) = 20:00 UTC, segunda a sexta
SELECT cron.schedule(
  'daily-cs-reminder-17h',
  '0 20 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/daily-cs-reminder',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);