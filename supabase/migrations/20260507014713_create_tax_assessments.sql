CREATE TABLE public.tax_assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competence          TEXT NOT NULL,
  tax_regime          TEXT NOT NULL DEFAULT 'simples_nacional',
  receita_bruta       NUMERIC(14,2),
  receita_acumulada   NUMERIC(14,2),
  invoice_count       INTEGER DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','declarado','das_gerado','pago')),
  declaracao_numero   TEXT,
  serpro_declaracao   JSONB,
  valor_das           NUMERIC(14,2),
  vencimento_das      TEXT,
  codigo_barras_das   TEXT,
  numero_das          TEXT,
  serpro_das          JSONB,
  declarado_em        TIMESTAMPTZ,
  gerado_em           TIMESTAMPTZ,
  pago_em             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, competence)
);

ALTER TABLE public.tax_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tax_assessments"
  ON public.tax_assessments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.tax_assessments IS 'Apuração de impostos por cliente e competência. Armazena resultado do pipeline PGDAS-D via SERPRO Integra Contador.';
