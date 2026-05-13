
-- Push subscriptions table
CREATE TABLE public.user_push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.user_push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscriptions"
  ON public.user_push_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own subscriptions"
  ON public.user_push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_user_push_subscriptions_user ON public.user_push_subscriptions(user_id);

-- pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger to call chat-notify on new message
CREATE OR REPLACE FUNCTION public.trg_notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/chat-notify';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo';
BEGIN
  PERFORM extensions.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_notify ON public.chat_messages;
CREATE TRIGGER chat_messages_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_chat_message();
