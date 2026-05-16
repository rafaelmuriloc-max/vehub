
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('triage-learning-reconcile') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'triage-learning-reconcile'
);

SELECT cron.schedule(
  'triage-learning-reconcile',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/triage-learning-reconcile',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
