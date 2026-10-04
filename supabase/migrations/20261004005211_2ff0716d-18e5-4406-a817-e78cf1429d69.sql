create or replace function public.portal_tax_payments(_client_id uuid, _from date, _to date)
returns table(fonte text, competencia text, status text, valor numeric, valor_pago numeric, data_pagamento date, data_vencimento date, pdf_b64 text)
language sql stable security definer set search_path = public as $$
  select 'SN', left(s.competencia::text, 7), s.status, s.valor_das, null::numeric, s.data_pagamento::date, s.data_vencimento::date, s.das_pdf_base64
  from simples_nacional_competencias s
  where s.client_id = _client_id and left(s.competencia::text,7) between to_char(_from,'YYYY-MM') and to_char(_to,'YYYY-MM')
    and public.portal_can_access_client(auth.uid(), _client_id)
  union all
  select 'MEI', left(m.competencia::text, 7), m.status, null, m.valor_pago, m.data_pagamento::date, null, null
  from mei_competencias m
  where m.client_id = _client_id and left(m.competencia::text,7) between to_char(_from,'YYYY-MM') and to_char(_to,'YYYY-MM')
    and public.portal_can_access_client(auth.uid(), _client_id)
  union all
  select 'DCTFWEB', left(d.competencia::text, 7), d.status, null, d.valor_pago, d.data_pagamento::date, null, null
  from dctfweb_competencias d
  where d.client_id = _client_id and coalesce(d.categoria,'GERAL_MENSAL') = 'GERAL_MENSAL'
    and left(d.competencia::text,7) between to_char(_from,'YYYY-MM') and to_char(_to,'YYYY-MM')
    and public.portal_can_access_client(auth.uid(), _client_id)
$$;
revoke all on function public.portal_tax_payments(uuid,date,date) from public, anon;
grant execute on function public.portal_tax_payments(uuid,date,date) to authenticated;