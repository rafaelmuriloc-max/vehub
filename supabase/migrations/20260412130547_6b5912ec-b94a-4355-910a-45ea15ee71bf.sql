
CREATE TABLE public.integra_contador_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  cache_value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.integra_contador_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.integra_contador_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_integra_cache_key ON public.integra_contador_cache(cache_key);
CREATE INDEX idx_integra_cache_expires ON public.integra_contador_cache(expires_at);
