CREATE TABLE public.dctfweb_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  categoria text NOT NULL DEFAULT 'GERAL_MENSAL',
  status text NOT NULL DEFAULT 'aberto',
  valor_pago numeric,
  data_pagamento date,
  mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, competencia, categoria)
);
GRANT SELECT ON public.dctfweb_competencias TO authenticated;
GRANT ALL ON public.dctfweb_competencias TO service_role;
ALTER TABLE public.dctfweb_competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view dctfweb_competencias" ON public.dctfweb_competencias FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_dctfweb_comp ON public.dctfweb_competencias (competencia, categoria);
CREATE TRIGGER update_dctfweb_comp_updated_at BEFORE UPDATE ON public.dctfweb_competencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();