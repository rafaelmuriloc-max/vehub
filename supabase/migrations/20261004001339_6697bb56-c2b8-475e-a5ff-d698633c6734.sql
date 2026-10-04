create or replace function public.portal_nfse(_client_id uuid, _from date, _to date)
returns table(id uuid, invoice_number text, issue_date timestamptz, gross_value numeric, status text, direction text, counterpart_cnpj text, counterpart_name text)
language sql stable security definer set search_path = public as $$
  with c as (select regexp_replace(coalesce(document,''),'\D','','g') d from clients where id = _client_id)
  select i.id, i.invoice_number::text, i.issue_date::timestamptz, i.gross_value::numeric, i.status::text,
    case when regexp_replace(coalesce(i.issuer_cnpj,''),'\D','','g') = c.d then 'saida' else 'entrada' end,
    case when regexp_replace(coalesce(i.issuer_cnpj,''),'\D','','g') = c.d then i.taker_cnpj else i.issuer_cnpj end,
    case when regexp_replace(coalesce(i.issuer_cnpj,''),'\D','','g') = c.d
      then substring(i.raw_data->>'xml' from '<toma>.*?<xNome>([^<]+)</xNome>')
      else substring(i.raw_data->>'xml' from '<emit>.*?<xNome>([^<]+)</xNome>') end
  from invoices i, c
  where public.portal_can_access_client(auth.uid(), _client_id)
    and i.client_id = _client_id and c.d <> ''
    and i.issue_date::date between _from and _to
    and (regexp_replace(coalesce(i.issuer_cnpj,''),'\D','','g') = c.d or regexp_replace(coalesce(i.taker_cnpj,''),'\D','','g') = c.d)
  order by i.issue_date desc
  limit 2000
$$;
revoke all on function public.portal_nfse(uuid, date, date) from public, anon;
grant execute on function public.portal_nfse(uuid, date, date) to authenticated;