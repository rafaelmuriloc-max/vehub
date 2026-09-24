CREATE TABLE public.nfce_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  access_key text NOT NULL UNIQUE,
  nsu text,
  invoice_number text,
  series text,
  issue_date timestamp with time zone,
  emitter_cnpj text,
  emitter_name text,
  consumer_document text,
  consumer_name text,
  total_value numeric NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'saida',
  status text NOT NULL DEFAULT 'autorizada',
  xml_url text,
  raw_xml text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfce_invoices_client ON public.nfce_invoices(client_id);
CREATE INDEX idx_nfce_invoices_issue_date ON public.nfce_invoices(issue_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfce_invoices TO authenticated;
GRANT ALL ON public.nfce_invoices TO service_role;

ALTER TABLE public.nfce_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view nfce_invoices" ON public.nfce_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert nfce_invoices" ON public.nfce_invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update nfce_invoices" ON public.nfce_invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete nfce_invoices" ON public.nfce_invoices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_nfce_invoices_updated_at BEFORE UPDATE ON public.nfce_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nfce_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  access_key text NOT NULL,
  tp_evento text NOT NULL,
  n_seq_evento integer NOT NULL DEFAULT 1,
  dh_evento timestamp with time zone,
  descricao text,
  nsu text,
  raw_xml text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nfce_events_unique UNIQUE (access_key, tp_evento, n_seq_evento)
);

CREATE INDEX idx_nfce_events_client ON public.nfce_events(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfce_events TO authenticated;
GRANT ALL ON public.nfce_events TO service_role;

ALTER TABLE public.nfce_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view nfce_events" ON public.nfce_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert nfce_events" ON public.nfce_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update nfce_events" ON public.nfce_events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete nfce_events" ON public.nfce_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_nfce_nsu text DEFAULT '0';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nfce_next_query_at timestamp with time zone;