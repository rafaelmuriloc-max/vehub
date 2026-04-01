
-- Create nfe_invoices table
CREATE TABLE public.nfe_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  access_key text UNIQUE,
  invoice_number text,
  issue_date date,
  emitter_cnpj text,
  emitter_name text,
  recipient_cnpj text,
  recipient_name text,
  total_value numeric DEFAULT 0,
  status text DEFAULT 'autorizada',
  nsu text,
  xml_url text,
  raw_xml text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.nfe_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view nfe_invoices"
  ON public.nfe_invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert nfe_invoices"
  ON public.nfe_invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update nfe_invoices"
  ON public.nfe_invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete nfe_invoices"
  ON public.nfe_invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Add last_nfe_nsu to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_nfe_nsu text;
