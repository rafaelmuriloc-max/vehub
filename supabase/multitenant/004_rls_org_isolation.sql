-- ============================================================================
-- 004 — Substitui TODAS as políticas abertas por isolamento de organização
-- NÃO APLICADO. Executar somente após 003 (org_id NOT NULL em tudo).
-- Regra base: o registro precisa ser da organização ativa do usuário.
-- Regras de departamento/papel continuam valendo DENTRO da organização.
-- ============================================================================

do $$
declare
  t text;
  p record;
  tables text[] := array[
    'asaas_charges','asaas_customers','asaas_settings','asaas_subscriptions','asaas_webhook_events',
    'bank_accounts','bill_payments','chat_conversations','chat_messages','chat_participants',
    'client_department_contacts','client_department_obligations','client_society_documents','clients',
    'company_settings','cost_centers','department_credentials','departments','document_types','documents',
    'email_attachments','email_logs','email_messages','financial_categories','financial_entries',
    'integra_contador_cache','invoices','nfe_invoices','nfe_sync_runs','obligation_activities',
    'obligation_activity_completions','obligation_instances','obligations','parcelamento_results','partners',
    'procurador_tokens','profile_departments','profiles','recurring_entries','scheduled_message_clients',
    'scheduled_message_deliveries','scheduled_message_runs','scheduled_messages','service_takers',
    'simples_nacional_competencias','sitfis_results','support_tickets','task_assignments','task_attachments',
    'task_templates','tasks','time_entries','triage_learnings','user_push_subscriptions','user_roles',
    'whatsapp_logs'
  ];
  admin_only text[] := array[
    'company_settings','departments','partners','asaas_settings','bank_accounts','cost_centers',
    'department_credentials','procurador_tokens','organization_integrations','user_roles'
  ];
begin
  foreach t in array tables loop
    -- remove todas as políticas antigas (inclusive as abertas a qualquer autenticado)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);

    if t = any (admin_only) then
      execute format(
        'create policy %I on public.%I for select to authenticated
           using (org_id = public.current_org_id())', t || '_org_select', t);
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (org_id = public.current_org_id() and public.is_org_admin(auth.uid(), org_id))
           with check (org_id = public.current_org_id() and public.is_org_admin(auth.uid(), org_id))',
        t || '_org_admin_write', t);
    else
      execute format(
        'create policy %I on public.%I for select to authenticated
           using (org_id = public.current_org_id())', t || '_org_select', t);
      execute format(
        'create policy %I on public.%I for insert to authenticated
           with check (org_id = public.current_org_id())', t || '_org_insert', t);
      execute format(
        'create policy %I on public.%I for update to authenticated
           using (org_id = public.current_org_id())
           with check (org_id = public.current_org_id())', t || '_org_update', t);
      execute format(
        'create policy %I on public.%I for delete to authenticated
           using (org_id = public.current_org_id()
                  and public.is_org_admin(auth.uid(), org_id))', t || '_org_delete', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------- refinamentos por departamento
-- Obrigações e instâncias continuam restritas ao departamento do membro.
drop policy if exists obligations_org_select on public.obligations;
create policy obligations_org_select on public.obligations for select to authenticated
  using (org_id = public.current_org_id()
         and public.member_can_access_department(auth.uid(), org_id, department_id));

drop policy if exists obligation_instances_org_select on public.obligation_instances;
create policy obligation_instances_org_select on public.obligation_instances for select to authenticated
  using (org_id = public.current_org_id()
         and exists (select 1 from public.obligations o
                     where o.id = obligation_id
                       and public.member_can_access_department(auth.uid(), org_id, o.department_id)));

-- Perfis: leitura dentro da org, escrita apenas do próprio perfil ou por admin da org.
drop policy if exists profiles_org_update on public.profiles;
create policy profiles_org_update on public.profiles for update to authenticated
  using (org_id = public.current_org_id()
         and (user_id = auth.uid() or public.is_org_admin(auth.uid(), org_id)))
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------- RPC/views
-- Funções SECURITY DEFINER existentes passam a filtrar por organização.
create or replace function public.get_calendar_month_completions(p_start date, p_end date)
returns table(id uuid, instance_id uuid, activity_id uuid, completed boolean,
              file_url text, notes text, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  with org as (select public.current_org_id() as id),
  inst as (
    select i.id from public.obligation_instances i, org
    where i.org_id = org.id and i.reference_month >= p_start and i.reference_month < p_end
    union
    select i.id from public.obligation_instances i, org
    where i.org_id = org.id and i.due_date >= p_start and i.due_date < p_end
  ),
  allowed_act as (
    select oa.id from public.obligation_activities oa
    join public.obligations o on o.id = oa.obligation_id, org
    where oa.org_id = org.id
      and public.member_can_access_department(auth.uid(), org.id, o.department_id)
  )
  select c.id, c.instance_id, c.activity_id, c.completed, c.file_url, c.notes, c.completed_at
  from public.obligation_activity_completions c, org
  join inst on inst.id = c.instance_id
  where c.org_id = org.id and c.activity_id in (select id from allowed_act);
$$;

create or replace function public.dashboard_client_counts(p_start date, p_end date)
returns table(active bigint, inactive bigint, novos bigint, churn bigint, suspended bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where status = 'active' and without_monthly_fee = false),
    count(*) filter (where status = 'inactive' and without_monthly_fee = false),
    count(*) filter (where without_monthly_fee = false and start_date >= p_start and start_date < p_end),
    count(*) filter (where without_monthly_fee = false and end_date >= p_start and end_date < p_end),
    count(*) filter (where status = 'active' and services_suspended = true)
  from public.clients
  where org_id = public.current_org_id();
$$;

create or replace function public.dashboard_task_counts(p_start date, p_end date, p_today date,
  p_today_start timestamptz, p_today_end timestamptz)
returns table(pending bigint, pending_no_date bigint, in_progress bigint, done bigint,
              overdue bigint, done_today bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where due_date >= p_start and due_date < p_end and status = 'todo'),
    count(*) filter (where due_date is null and status = 'todo'),
    count(*) filter (where due_date >= p_start and due_date < p_end and status in ('in_progress','in_review')),
    count(*) filter (where due_date >= p_start and due_date < p_end and status = 'done'),
    count(*) filter (where due_date >= p_start and due_date < p_today and status <> 'done'),
    count(*) filter (where status = 'done' and updated_at >= p_today_start and updated_at < p_today_end)
  from public.tasks
  where org_id = public.current_org_id();
$$;

create or replace function public.get_chat_inbox(p_user uuid, p_tab text)
returns table(id uuid, name text, status text, assigned_to uuid, whatsapp_phone text, client_id uuid,
              avatar_url text, is_group boolean, created_at timestamptz, updated_at timestamptz,
              last_message text, last_message_at timestamptz, last_message_type text, unread_count integer,
              assigned_to_name text, assigned_to_color text, waiting_since timestamptz,
              total_wait_seconds integer, awaiting_first_reply boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public.current_org_id();
begin
  -- impede que um usuário leia a caixa de entrada de outro usuário/organização
  if p_user is distinct from auth.uid() or v_org is null then
    raise exception 'forbidden';
  end if;
  return query
  with filtered as materialized (
    select c.* from public.chat_conversations c
    where c.org_id = v_org
      and case p_tab
        when 'mine' then c.assigned_to = p_user and c.status = 'open'
        when 'in_progress' then c.status = 'open' and c.assigned_to is null
        else true end
  ),
  latest as materialized (
    select distinct on (m.conversation_id) m.conversation_id, m.content, m.created_at,
           m.message_type, m.deleted_at
    from public.chat_messages m join filtered c on c.id = m.conversation_id
    where not (p_user = any(m.deleted_for))
    order by m.conversation_id, m.created_at desc
  ),
  unread as materialized (
    select m.conversation_id, count(*)::integer cnt
    from public.chat_messages m join filtered c on c.id = m.conversation_id
    where m.message_type like 'whatsapp_incoming%' and m.read_at is null
      and m.deleted_at is null and not (p_user = any(m.deleted_for))
    group by m.conversation_id
  )
  select c.id, c.name, c.status, c.assigned_to, c.whatsapp_phone, c.client_id, c.avatar_url, c.is_group,
         c.created_at, c.updated_at,
         case when l.deleted_at is not null then '🚫 Mensagem apagada' else l.content end,
         l.created_at, l.message_type, coalesce(u.cnt, 0), p.full_name, p.tag_color,
         c.waiting_since, c.total_wait_seconds, c.awaiting_first_reply
  from filtered c
  left join latest l on l.conversation_id = c.id
  left join unread u on u.conversation_id = c.id
  left join public.profiles p on p.user_id = c.assigned_to and p.org_id = v_org
  order by coalesce(l.created_at, c.updated_at) desc;
end $$;

-- delete_conversation_cascade: admin DA ORGANIZAÇÃO da conversa, nunca admin global
create or replace function public.delete_conversation_cascade(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.chat_conversations where id = p_id;
  if v_org is null or not public.is_org_admin(auth.uid(), v_org) then
    raise exception 'forbidden';
  end if;
  delete from public.chat_messages where conversation_id = p_id;
  delete from public.chat_participants where conversation_id = p_id;
  delete from public.chat_conversations where id = p_id;
end $$;

-- resolve_client_by_phone: precisa da organização para não cruzar escritórios
create or replace function public.resolve_client_by_phone(_phone text, _org_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare d text; local10 text; local11 text; v_id uuid; v_count int;
begin
  if _phone is null or _org_id is null then return null; end if;
  d := regexp_replace(_phone, '\D', '', 'g');
  if length(d) < 10 then return null; end if;
  if length(d) > 11 and left(d, 2) = '55' then d := substr(d, 3); end if;
  if length(d) = 11 then local11 := d; local10 := left(d,2) || substr(d,4);
  elsif length(d) = 10 then local10 := d; local11 := left(d,2) || '9' || substr(d,3);
  else return null; end if;

  with matches as (
    select c.id cid from public.clients c
     where c.org_id = _org_id
       and regexp_replace(coalesce(c.contact_phone,''), '\D', '', 'g') <> ''
       and (regexp_replace(c.contact_phone,'\D','','g') like '%' || local10
         or regexp_replace(c.contact_phone,'\D','','g') like '%' || local11)
    union
    select cdc.client_id from public.client_department_contacts cdc
     where cdc.org_id = _org_id
       and regexp_replace(coalesce(cdc.contact_phone,''), '\D', '', 'g') <> ''
       and (regexp_replace(cdc.contact_phone,'\D','','g') like '%' || local10
         or regexp_replace(cdc.contact_phone,'\D','','g') like '%' || local11)
  )
  select count(*), (array_agg(cid))[1] into v_count, v_id from matches;
  if v_count = 1 then return v_id; end if;
  return null;
end $$;

-- ------------------------------------------------------------------ realtime
-- Realtime respeita RLS das tabelas acima; nenhuma publicação nova é criada
-- aqui. Verificar após aplicação:
--   select * from pg_publication_tables where pubname = 'supabase_realtime';
