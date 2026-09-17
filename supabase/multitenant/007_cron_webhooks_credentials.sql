-- ============================================================================
-- 007 — Cron por organização e resolução inequívoca de webhooks
-- NÃO APLICADO.
-- ============================================================================

-- 1) Resolução de organização para webhooks (sem JWT do usuário).
--    O webhook precisa identificar a org pelo identificador da integração.
--    Retorna NULL quando ambíguo — o handler deve rejeitar com 400.
create or replace function public.resolve_org_by_integration(_provider text, _external_ref text)
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.organization_integrations
  where provider = _provider
    and external_ref is not distinct from _external_ref
    and enabled = true;
$$;

revoke all on function public.resolve_org_by_integration(text, text) from public, anon, authenticated;
grant execute on function public.resolve_org_by_integration(text, text) to service_role;

-- 2) Lista de organizações ativas para os jobs agendados iterarem
create or replace function public.active_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.organizations where status = 'active' order by created_at;
$$;

revoke all on function public.active_org_ids() from public, anon, authenticated;
grant execute on function public.active_org_ids() to service_role;

-- 3) Auditoria mínima de execução por organização (idempotência dos jobs)
create table if not exists public.org_job_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_name text not null,
  run_key text not null,
  status text not null default 'running',
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (org_id, job_name, run_key)
);

grant select on public.org_job_runs to authenticated;
grant all on public.org_job_runs to service_role;
alter table public.org_job_runs enable row level security;

drop policy if exists org_job_runs_select on public.org_job_runs;
create policy org_job_runs_select on public.org_job_runs for select to authenticated
  using (org_id = public.current_org_id());

-- 4) Os 11 jobs de pg_cron continuam apontando para as mesmas edge functions.
--    A mudança é DENTRO das funções: elas passam a iterar active_org_ids()
--    e usar as credenciais de organization_integrations de cada organização.
--    Nenhum job é recriado aqui para não alterar o agendamento em produção.
--    Conferir depois de aplicar:
--      select jobid, jobname, schedule, active from cron.job order by jobid;
