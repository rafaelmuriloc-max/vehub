CREATE TABLE public.nfe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  access_key text NOT NULL,
  tp_evento text NOT NULL,
  n_seq_evento integer NOT NULL DEFAULT 1,
  dh_evento timestamptz,
  descricao text,
  nsu text,
  raw_xml text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (access_key, tp_evento, n_seq_evento)
);
CREATE INDEX idx_nfe_events_client ON public.nfe_events(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfe_events TO authenticated;
GRANT ALL ON public.nfe_events TO service_role;
ALTER TABLE public.nfe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view nfe_events" ON public.nfe_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert nfe_events" ON public.nfe_events FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));
CREATE POLICY "Admins can update nfe_events" ON public.nfe_events FOR UPDATE TO authenticated USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));
CREATE POLICY "Admins can delete nfe_events" ON public.nfe_events FOR DELETE TO authenticated USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nfe_next_query_at timestamptz;