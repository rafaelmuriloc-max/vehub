CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  client_id uuid,
  obligation_id uuid,
  reference_month date,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email_logs" ON public.email_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert email_logs" ON public.email_logs
  FOR INSERT TO authenticated WITH CHECK (true);