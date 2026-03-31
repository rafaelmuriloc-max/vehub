
CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  obligation_id uuid,
  instance_id uuid,
  recipient_phone text NOT NULL,
  template_name text,
  template_params jsonb,
  body_text text,
  status text NOT NULL DEFAULT 'sent',
  wamid text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view whatsapp_logs" ON public.whatsapp_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert whatsapp_logs" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.obligation_activities
  ADD COLUMN whatsapp_template_name text,
  ADD COLUMN whatsapp_message_body text;
