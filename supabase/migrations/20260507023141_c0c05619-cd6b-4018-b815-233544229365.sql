UPDATE public.nfe_invoices ni
SET 
  invoice_number = COALESCE(ni.invoice_number, NULLIF(ltrim(substring(ni.access_key from 26 for 9), '0'), '')),
  recipient_cnpj = COALESCE(ni.recipient_cnpj, regexp_replace(c.document, '\D', '', 'g')),
  recipient_name = COALESCE(ni.recipient_name, c.company_name),
  emitter_name   = COALESCE(ni.emitter_name, (regexp_match(ni.raw_xml, '<xNome>([^<]+)</xNome>'))[1]),
  emitter_cnpj   = COALESCE(ni.emitter_cnpj, (regexp_match(ni.raw_xml, '<CNPJ>(\d{14})</CNPJ>'))[1])
FROM public.clients c
WHERE c.id = ni.client_id
  AND ni.access_key IS NOT NULL
  AND length(ni.access_key) = 44;