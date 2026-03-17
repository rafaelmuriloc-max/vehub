
-- Create invoices table for NFS-e management
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  access_key text UNIQUE,
  invoice_number text,
  issue_date date,
  service_description text,
  gross_value numeric DEFAULT 0,
  tax_value numeric DEFAULT 0,
  net_value numeric DEFAULT 0,
  status text DEFAULT 'normal',
  xml_url text,
  pdf_url text,
  issuer_cnpj text,
  taker_cnpj text,
  municipality_code text,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view invoices"
ON public.invoices FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoices"
ON public.invoices FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also allow service_role (edge function) to insert/update
-- The edge function uses service role key so RLS is bypassed

-- Timestamp trigger
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX idx_invoices_issuer_cnpj ON public.invoices(issuer_cnpj);
