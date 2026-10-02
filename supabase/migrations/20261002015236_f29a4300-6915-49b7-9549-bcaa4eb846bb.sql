CREATE TABLE IF NOT EXISTS public.mei_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  valor_pago numeric,
  data_pagamento date,
  mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, competencia)
);
GRANT SELECT ON public.mei_competencias TO authenticated;
GRANT ALL ON public.mei_competencias TO service_role;
ALTER TABLE public.mei_competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view mei competencias" ON public.mei_competencias FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_mei_competencias_updated_at BEFORE UPDATE ON public.mei_competencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();