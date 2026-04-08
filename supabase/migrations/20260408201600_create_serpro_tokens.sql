-- Tabela para cache de tokens SERPRO (OAuth2 bearer + procurador)
-- client_id NULL  => token de escritório (bearer/OAuth2), compartilhado entre clientes
-- client_id UUID  => token de procurador por cliente específico

CREATE TABLE public.serpro_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  token_type       TEXT NOT NULL CHECK (token_type IN ('bearer', 'procurador')),
  access_token     TEXT,
  jwt_token        TEXT,
  procurador_token TEXT,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Índice único para (client_id, token_type): trata NULL separadamente pois
-- UNIQUE constraint padrão não deduplicaria múltiplos NULLs no PostgreSQL.
CREATE UNIQUE INDEX serpro_tokens_client_type_null_idx
  ON public.serpro_tokens (token_type)
  WHERE client_id IS NULL;

CREATE UNIQUE INDEX serpro_tokens_client_type_idx
  ON public.serpro_tokens (client_id, token_type)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.serpro_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage serpro_tokens"
  ON public.serpro_tokens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.serpro_tokens IS 'Cache de tokens da API SERPRO Integra Contador. client_id NULL = bearer token do escritório; client_id preenchido = token de procurador do cliente.';
COMMENT ON COLUMN public.serpro_tokens.token_type IS 'bearer = OAuth2 access_token do escritório; procurador = autenticar_procurador_token por cliente';
COMMENT ON COLUMN public.serpro_tokens.expires_at IS 'Timestamp de expiração (já com margem de 60s)';
