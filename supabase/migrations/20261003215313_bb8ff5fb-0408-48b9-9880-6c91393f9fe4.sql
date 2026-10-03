-- Portal: leitura de vencimentos e documentos via funções que conferem o acesso
create or replace function public.portal_safe_uuid(_t text) returns uuid language plpgsql immutable as $$
begin return _t::uuid; exception when others then return null; end $$;

create or replace function public.portal_due_dates(_client_id uuid, _from date, _to date)
returns table(id uuid, name text, due_date date, reference_month date, status text, system_code text)
language sql stable security definer set search_path = public as $$
  select i.id, o.name, i.due_date, i.reference_month, i.status::text, o.system_code
  from obligation_instances i join obligations o on o.id = i.obligation_id
  where i.client_id = _client_id and i.deleted_at is null and coalesce(o.is_tax,false)
    and i.due_date between _from and _to
    and public.portal_can_access_client(auth.uid(), _client_id)
  order by i.due_date
$$;

create or replace function public.portal_documents(_client_id uuid)
returns table(id uuid, label text, area text, reference_month date, file_url text, file_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, coalesce(t.name, d.file_name), 'Documento', d.reference_month, d.file_url, d.file_name, d.created_at
  from documents d left join document_types t on t.id = d.document_type_id
  where d.client_id = _client_id and public.portal_can_access_client(auth.uid(), _client_id)
  union all
  select s.id, s.document_label, 'Societário', null, s.file_url, s.file_name, s.created_at
  from client_society_documents s
  where s.client_id = _client_id and public.portal_can_access_client(auth.uid(), _client_id)
  order by 7 desc limit 200
$$;

revoke all on function public.portal_due_dates(uuid,date,date) from public, anon;
revoke all on function public.portal_documents(uuid) from public, anon;
grant execute on function public.portal_due_dates(uuid,date,date) to authenticated;
grant execute on function public.portal_documents(uuid) to authenticated;

-- Storage: cliente do portal só lê arquivos da própria empresa no bucket documents
drop policy if exists "Portal client storage guard" on storage.objects;
create policy "Portal client storage guard" on storage.objects as restrictive for all to public
  using (not public.is_portal_client(auth.uid())
         or (bucket_id = 'documents' and public.portal_can_access_client(auth.uid(), public.portal_safe_uuid((storage.foldername(name))[1]))))
  with check (not public.is_portal_client(auth.uid()));