-- ============================================================================
-- 003 — Backfill do escritório existente e travamento (NOT NULL + default)
-- NÃO APLICADO. Executar somente após 002 e com backup.
-- Preserva os 8 usuários atuais e todos os dados do escritório existente.
-- ============================================================================

-- 1) Organização a partir do único registro de company_settings
insert into public.organizations (id, name, slug)
select coalesce(
         (select org_id from public.company_settings where org_id is not null limit 1),
         gen_random_uuid()),
       coalesce((select nullif(trim(company_name), '') from public.company_settings limit 1),
                'Escritório principal'),
       'escritorio-principal'
where not exists (select 1 from public.organizations where slug = 'escritorio-principal');

-- 2) Membros: todos os usuários atuais, preservando o papel legado
insert into public.organization_members (org_id, user_id, role, status)
select o.id, ur.user_id, ur.role, 'active'
from public.user_roles ur
cross join (select id from public.organizations where slug = 'escritorio-principal') o
on conflict (org_id, user_id) do nothing;

-- usuários sem papel registrado entram como employee
insert into public.organization_members (org_id, user_id, role, status)
select o.id, p.user_id, 'employee', 'active'
from public.profiles p
cross join (select id from public.organizations where slug = 'escritorio-principal') o
on conflict (org_id, user_id) do nothing;

-- 3) Departamentos dos membros, preservando profile_departments
insert into public.organization_member_departments (member_id, department_id)
select m.id, pd.department_id
from public.profile_departments pd
join public.organization_members m on m.user_id = pd.user_id
on conflict do nothing;

-- 4) Backfill de org_id em todas as tabelas de negócio
do $$
declare
  t text;
  v_org uuid;
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
begin
  select id into v_org from public.organizations where slug = 'escritorio-principal';
  if v_org is null then
    raise exception 'organização base não encontrada';
  end if;

  foreach t in array tables loop
    execute format('update public.%I set org_id = %L where org_id is null', t, v_org);
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('alter table public.%I alter column org_id set default public.current_org_id()', t);
  end loop;
end $$;

-- 5) Integridade referencial entre organizações:
--    relacionamentos precisam pertencer à MESMA organização.
create or replace function public.assert_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent_table text := tg_argv[0];
  parent_col   text := tg_argv[1];
  child_val    uuid;
  parent_org   uuid;
begin
  execute format('select ($1).%I', parent_col) into child_val using new;
  if child_val is null then return new; end if;
  execute format('select org_id from public.%I where id = $1', parent_table)
    into parent_org using child_val;
  if parent_org is not null and parent_org <> new.org_id then
    raise exception 'cross-tenant reference blocked: %.% -> %', tg_table_name, parent_col, parent_table;
  end if;
  return new;
end $$;

do $$
declare
  r record;
  pairs text[][] := array[
    array['obligation_instances','clients','client_id'],
    array['obligation_instances','obligations','obligation_id'],
    array['obligation_activity_completions','obligation_instances','instance_id'],
    array['tasks','clients','client_id'],
    array['task_assignments','tasks','task_id'],
    array['task_attachments','tasks','task_id'],
    array['chat_conversations','clients','client_id'],
    array['chat_messages','chat_conversations','conversation_id'],
    array['chat_participants','chat_conversations','conversation_id'],
    array['client_department_contacts','clients','client_id'],
    array['client_department_obligations','clients','client_id'],
    array['documents','clients','client_id'],
    array['financial_entries','clients','client_id'],
    array['invoices','clients','client_id'],
    array['nfe_invoices','clients','client_id'],
    array['support_tickets','chat_conversations','conversation_id'],
    array['time_entries','tasks','task_id'],
    array['sitfis_results','clients','client_id']
  ];
begin
  for r in select pairs[i][1] as child, pairs[i][2] as parent, pairs[i][3] as col
           from generate_subscripts(pairs, 1) i loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'trg_same_org_' || r.child || '_' || r.col, r.child);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.assert_same_org(%L, %L)',
      'trg_same_org_' || r.child || '_' || r.col, r.child, r.parent, r.col);
  end loop;
end $$;
