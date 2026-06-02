
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('scheduled-messages-runner');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'scheduled-messages-runner',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/scheduled-messages-runner',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);
