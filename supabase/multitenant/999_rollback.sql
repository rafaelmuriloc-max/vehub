-- ============================================================================
-- 999 — Reversão
-- NÃO APLICADO. Use na ordem inversa da aplicação.
-- Reverter DEPOIS de 004 exige restaurar as políticas originais a partir do
-- backup (elas são apagadas em 004). Faça o dump abaixo ANTES de aplicar 004:
--   \copy (select * from pg_policies where schemaname in ('public','storage'))
--        to 'policies_backup.csv' csv header
-- ============================================================================

-- Reverter 006/007 — volta o comportamento de papel legado e ingresso automático
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'employee');
  return new;
end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

drop function if exists public.accept_org_invite(text);
drop function if exists public.create_org_invite(uuid, text, public.app_role, uuid[], int);
drop function if exists public.remove_org_member(uuid, uuid);
drop function if exists public.resolve_org_by_integration(text, text);
drop function if exists public.active_org_ids();

-- Reverter 005 — remove as políticas de storage por organização
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname like 'org_%' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Reverter 003 — solta a obrigatoriedade de org_id (mantém os valores)
do $$
declare t text; tables text[] := array[
  'clients','tasks','obligation_instances','obligations','chat_conversations','chat_messages','documents'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I alter column org_id drop not null', t);
    execute format('alter table public.%I alter column org_id drop default', t);
  end loop;
end $$;
-- (repetir para as demais tabelas listadas em 002, se necessário)

-- Reverter 001/002 — só quando houver UMA organização e nenhum dado novo.
-- drop table if exists public.organization_member_departments cascade;
-- drop table if exists public.organization_invites cascade;
-- drop table if exists public.organization_integrations cascade;
-- drop table if exists public.organization_members cascade;
-- drop table if exists public.org_job_runs cascade;
-- drop table if exists public.organizations cascade;
