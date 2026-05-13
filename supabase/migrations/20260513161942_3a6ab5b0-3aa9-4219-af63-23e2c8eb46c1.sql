CREATE OR REPLACE FUNCTION public.trg_notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  fn_url text := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/chat-notify';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || anon_key
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trg_notify_chat_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;