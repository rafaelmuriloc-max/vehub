
-- 1) Columns in company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS gmail_connected_email text,
  ADD COLUMN IF NOT EXISTS gmail_last_history_id text,
  ADD COLUMN IF NOT EXISTS gmail_last_sync_at timestamptz;

-- 2) email_messages
CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text NOT NULL UNIQUE,
  gmail_thread_id text,
  from_email text,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text,
  snippet text,
  body_html text,
  body_text text,
  received_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_trashed boolean NOT NULL DEFAULT false,
  is_sent boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  labels text[] NOT NULL DEFAULT '{}',
  client_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON public.email_messages (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON public.email_messages (gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_client ON public.email_messages (client_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_flags ON public.email_messages (is_trashed, is_archived, is_sent, is_read);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email_messages"
  ON public.email_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update email_messages"
  ON public.email_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- INSERT/DELETE only service_role (no explicit policy = denied for authenticated)

CREATE TRIGGER trg_email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) email_attachments
CREATE TABLE IF NOT EXISTS public.email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  gmail_attachment_id text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON public.email_attachments (message_id);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email_attachments"
  ON public.email_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update email_attachments"
  ON public.email_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4) Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read email attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-attachments');

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;
ALTER TABLE public.email_messages REPLICA IDENTITY FULL;
