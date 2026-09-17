-- ============================================================================
-- 002 — Adiciona org_id (NULL) em todas as tabelas de negócio + índices
-- NÃO APLICADO. Passo não destrutivo: nada quebra enquanto org_id for NULL.
-- ============================================================================

do $$
declare
  t text;
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
  foreach t in array tables loop
    execute format(
      'alter table public.%I add column if not exists org_id uuid references public.organizations(id)', t);
    execute format(
      'create index if not exists %I on public.%I (org_id)', 'idx_' || t || '_org', t);
  end loop;
end $$;

-- Índices compostos nas colunas mais consultadas (org_id primeiro)
create index if not exists idx_obligation_instances_org_ref
  on public.obligation_instances (org_id, reference_month);
create index if not exists idx_obligation_instances_org_due
  on public.obligation_instances (org_id, due_date);
create index if not exists idx_tasks_org_due on public.tasks (org_id, due_date);
create index if not exists idx_chat_messages_org_conv
  on public.chat_messages (org_id, conversation_id, created_at desc);
create index if not exists idx_clients_org_status on public.clients (org_id, status);
