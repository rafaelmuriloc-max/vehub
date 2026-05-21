CREATE TABLE public.parcelamento_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  modalidade text NOT NULL,
  modalidade_label text,
  numero_parcelamento text,
  situacao text,
  data_pedido date,
  valor_total numeric,
  parcelas_pagas integer,
  parcelas_total integer,
  raw_response jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  consulted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parcelamento_results_client ON public.parcelamento_results(client_id);
CREATE INDEX idx_parcelamento_results_client_modalidade ON public.parcelamento_results(client_id, modalidade);

ALTER TABLE public.parcelamento_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage parcelamento_results"
  ON public.parcelamento_results
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view parcelamento_results"
  ON public.parcelamento_results
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));