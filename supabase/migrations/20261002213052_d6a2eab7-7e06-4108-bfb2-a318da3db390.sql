CREATE TABLE public.fgts_digital_guias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  numero_guia text NOT NULL DEFAULT '',
  tipo text,
  situacao text,
  data_emissao date,
  data_vencimento date,
  data_pagamento date,
  valor_total numeric,
  guia_pdf_url text,
  raw jsonb,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, competencia, numero_guia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fgts_digital_guias TO authenticated;
GRANT ALL ON public.fgts_digital_guias TO service_role;
ALTER TABLE public.fgts_digital_guias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage fgts guias" ON public.fgts_digital_guias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER fgts_guias_updated BEFORE UPDATE ON public.fgts_digital_guias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_fgts_guias_comp ON public.fgts_digital_guias(competencia);