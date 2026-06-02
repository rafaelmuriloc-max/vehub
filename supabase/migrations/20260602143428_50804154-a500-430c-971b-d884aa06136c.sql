
CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid NOT NULL,
  recurrence text NOT NULL DEFAULT 'monthly',
  weekly_day smallint,
  monthly_day smallint,
  annual_month smallint,
  custom_months smallint[] DEFAULT '{}',
  send_time time NOT NULL DEFAULT '09:00',
  anticipate_weekend boolean NOT NULL DEFAULT true,
  assignment_mode text NOT NULL DEFAULT 'manual',
  segment_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_body text NOT NULL,
  attachment_url text,
  attachment_name text,
  attachment_mime text,
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO authenticated;
GRANT ALL ON public.scheduled_messages TO service_role;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View scheduled_messages by department" ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (public.user_can_access_department(auth.uid(), department_id));
CREATE POLICY "Admins insert scheduled_messages" ON public.scheduled_messages
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update scheduled_messages" ON public.scheduled_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete scheduled_messages" ON public.scheduled_messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.scheduled_message_clients (
  scheduled_message_id uuid NOT NULL REFERENCES public.scheduled_messages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  PRIMARY KEY (scheduled_message_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_message_clients TO authenticated;
GRANT ALL ON public.scheduled_message_clients TO service_role;
ALTER TABLE public.scheduled_message_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View scheduled_message_clients" ON public.scheduled_message_clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage scheduled_message_clients" ON public.scheduled_message_clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.scheduled_message_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id uuid NOT NULL REFERENCES public.scheduled_messages(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  status_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheduled_message_id, run_at)
);
GRANT SELECT ON public.scheduled_message_runs TO authenticated;
GRANT ALL ON public.scheduled_message_runs TO service_role;
ALTER TABLE public.scheduled_message_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View scheduled_message_runs" ON public.scheduled_message_runs
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.scheduled_message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.scheduled_message_runs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  status text NOT NULL,
  error text,
  chat_message_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scheduled_message_deliveries TO authenticated;
GRANT ALL ON public.scheduled_message_deliveries TO service_role;
ALTER TABLE public.scheduled_message_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View scheduled_message_deliveries" ON public.scheduled_message_deliveries
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_scheduled_messages_next_run ON public.scheduled_messages(next_run_at) WHERE active = true;
CREATE INDEX idx_smd_run ON public.scheduled_message_deliveries(run_id);
