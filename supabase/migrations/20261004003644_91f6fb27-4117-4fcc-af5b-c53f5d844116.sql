drop function if exists public.portal_due_dates(uuid,date,date);
create function public.portal_due_dates(_client_id uuid, _from date, _to date)
returns table(id uuid, name text, due_date date, reference_month date, status text, system_code text, file_url text, file_name text)
language sql stable security definer set search_path = public as $$
  select i.id, o.name, i.due_date, i.reference_month, i.status::text, o.system_code, f.file_url,
         regexp_replace(f.file_url, '^.*/', '')
  from obligation_instances i join obligations o on o.id = i.obligation_id
  left join lateral (
    select c.file_url from obligation_activity_completions c
    where c.instance_id = i.id and c.file_url is not null
    order by c.completed_at desc nulls last limit 1) f on true
  where i.client_id = _client_id and i.deleted_at is null and coalesce(o.is_tax,false)
    and i.due_date between _from and _to
    and public.portal_can_access_client(auth.uid(), _client_id)
  order by i.due_date
$$;
revoke all on function public.portal_due_dates(uuid,date,date) from public, anon;
grant execute on function public.portal_due_dates(uuid,date,date) to authenticated;