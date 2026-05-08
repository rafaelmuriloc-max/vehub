ALTER TABLE public.nfe_invoices
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'entrada';

UPDATE public.nfe_invoices n
   SET direction = 'saida'
  FROM public.clients c
 WHERE c.id = n.client_id
   AND regexp_replace(coalesce(n.emitter_cnpj, ''), '\D', '', 'g') <> ''
   AND regexp_replace(coalesce(n.emitter_cnpj, ''), '\D', '', 'g')
       = regexp_replace(coalesce(c.document, ''), '\D', '', 'g');

CREATE INDEX IF NOT EXISTS idx_nfe_invoices_direction
  ON public.nfe_invoices (client_id, direction);