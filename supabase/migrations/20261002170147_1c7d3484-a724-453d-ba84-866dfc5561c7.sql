CREATE TABLE public.integra_contador_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  id_sistema text NOT NULL,
  id_servico text NOT NULL,
  tipo text NOT NULL,
  status_http integer,
  sucesso boolean NOT NULL DEFAULT false,
  cobrada boolean NOT NULL DEFAULT true,
  duracao_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integra_contador_usage TO authenticated;
GRANT ALL ON public.integra_contador_usage TO service_role;
ALTER TABLE public.integra_contador_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read usage" ON public.integra_contador_usage FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_ic_usage_created ON public.integra_contador_usage (created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.integra_contador_usage;