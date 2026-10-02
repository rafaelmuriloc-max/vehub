CREATE TABLE public.personnel_alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL,
  recipient_phone text,
  recipient_name text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  employees_count integer NOT NULL DEFAULT 0,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.personnel_alert_logs TO authenticated;
GRANT ALL ON public.personnel_alert_logs TO service_role;
ALTER TABLE public.personnel_alert_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read alert logs" ON public.personnel_alert_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert alert logs" ON public.personnel_alert_logs FOR INSERT TO authenticated WITH CHECK (sent_by = auth.uid());
CREATE INDEX idx_pal_client_kind ON public.personnel_alert_logs(client_id, kind, created_at DESC);