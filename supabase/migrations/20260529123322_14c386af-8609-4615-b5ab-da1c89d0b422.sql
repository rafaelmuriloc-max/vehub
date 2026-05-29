
-- Tabela de cache do Simples Nacional por competência
CREATE TABLE public.simples_nacional_competencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  competencia DATE NOT NULL, -- primeiro dia do mês de apuração
  ano INTEGER NOT NULL,
  rbt12 NUMERIC,
  rba_acumulado_ano NUMERIC,
  valor_das NUMERIC,
  numero_das TEXT,
  numero_declaracao TEXT,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'aberto', -- 'pago' | 'aberto' | 'sem_movimento'
  das_pdf_base64 TEXT,
  declaracao_pdf_base64 TEXT,
  comprovante_pdf_base64 TEXT,
  raw_response JSONB,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (client_id, competencia)
);

CREATE INDEX idx_snc_client ON public.simples_nacional_competencias (client_id);
CREATE INDEX idx_snc_ano ON public.simples_nacional_competencias (ano);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simples_nacional_competencias TO authenticated;
GRANT ALL ON public.simples_nacional_competencias TO service_role;

ALTER TABLE public.simples_nacional_competencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view simples_nacional_competencias"
  ON public.simples_nacional_competencias
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert simples_nacional_competencias"
  ON public.simples_nacional_competencias
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update simples_nacional_competencias"
  ON public.simples_nacional_competencias
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete simples_nacional_competencias"
  ON public.simples_nacional_competencias
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_snc_updated_at
  BEFORE UPDATE ON public.simples_nacional_competencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
