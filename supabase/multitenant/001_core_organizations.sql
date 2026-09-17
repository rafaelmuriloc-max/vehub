-- ============================================================================
-- 001 — Núcleo multi-tenant: organizações, membros, convites e credenciais
-- NÃO APLICADO. Revisar e aplicar manualmente (ver docs/multi-tenant.md).
-- Idempotente. Não altera nenhuma tabela de negócio.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- organizações
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

-- ------------------------------------------------------------------- membros
-- Papel É POR ORGANIZAÇÃO. public.user_roles permanece apenas como legado
-- durante a transição (ver 006) e deixa de autorizar ações fora da org.
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null default 'employee',
  status text not null default 'active',            -- active | removed
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members(user_id) where status = 'active';
create index if not exists idx_org_members_org on public.organization_members(org_id) where status = 'active';

grant select on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

-- departamentos do membro, por organização
create table if not exists public.organization_member_departments (
  member_id uuid not null references public.organization_members(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  primary key (member_id, department_id)
);

grant select on public.organization_member_departments to authenticated;
grant all on public.organization_member_departments to service_role;
alter table public.organization_member_departments enable row level security;

-- ------------------------------------------------------------------ convites
-- Uso único, expirável, verificado. NÃO existe auto-join por domínio.
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email citext_or_text_placeholder text generated always as (null) stored, -- placeholder removido abaixo
  invited_email text not null,
  role public.app_role not null default 'employee',
  department_ids uuid[] not null default '{}',
  token_hash text not null unique,                  -- sha256 do token; token bruto nunca é persistido
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

alter table public.organization_invites drop column if exists email;

create index if not exists idx_org_invites_pending
  on public.organization_invites (lower(invited_email))
  where accepted_at is null and revoked_at is null;

grant select on public.organization_invites to authenticated;
grant all on public.organization_invites to service_role;
alter table public.organization_invites enable row level security;

-- --------------------------------------------- credenciais isoladas por org
-- Nenhuma organização nova herda segredos da organização existente.
-- Valores sensíveis NÃO ficam aqui: apenas a referência ao nome do secret
-- e configuração não sensível. Segredos continuam em Project Settings.
create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,                            -- whatsapp_meta | evolution | asaas | serpro | gmail | nfe_proxy
  external_ref text,                                 -- instância/conta que identifica o webhook
  config jsonb not null default '{}'::jsonb,         -- somente dados não sensíveis
  secret_names jsonb not null default '{}'::jsonb,   -- {"api_key":"ASAAS_API_KEY__ACME"} — nomes, nunca valores
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

-- resolução inequívoca de webhook: um external_ref pertence a uma única org
create unique index if not exists uq_org_integration_external_ref
  on public.organization_integrations (provider, external_ref)
  where external_ref is not null;

grant select on public.organization_integrations to authenticated;
grant all on public.organization_integrations to service_role;
alter table public.organization_integrations enable row level security;

-- ------------------------------------------------------- funções auxiliares
create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where user_id = _user_id and org_id = _org_id and status = 'active'
  );
$$;

create or replace function public.org_role(_user_id uuid, _org_id uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.organization_members
  where user_id = _user_id and org_id = _org_id and status = 'active';
$$;

-- admin SEMPRE relativo a uma organização; não existe admin global
create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role(_user_id, _org_id) = 'admin'::public.app_role;
$$;

-- organização ativa do request: claim `org_id` no JWT, senão única org do usuário
create or replace function public.current_org_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  claim text;
  v_org uuid;
begin
  claim := nullif(current_setting('request.jwt.claims', true), '');
  if claim is not null then
    v_org := nullif(((claim::jsonb) -> 'app_metadata' ->> 'org_id'), '')::uuid;
    if v_org is not null and public.is_org_member(auth.uid(), v_org) then
      return v_org;
    end if;
  end if;

  select org_id into v_org
  from public.organization_members
  where user_id = auth.uid() and status = 'active'
  limit 2;

  if (select count(*) from public.organization_members
      where user_id = auth.uid() and status = 'active') = 1 then
    return v_org;
  end if;

  return null;  -- múltiplas orgs sem claim => nega por padrão
end;
$$;

-- acesso a departamento, sempre dentro da organização
create or replace function public.member_can_access_department(_user_id uuid, _org_id uuid, _department_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_org_admin(_user_id, _org_id)
    or _department_id is null
    or not exists (
      select 1 from public.organization_member_departments d
      join public.organization_members m on m.id = d.member_id
      where m.user_id = _user_id and m.org_id = _org_id and m.status = 'active'
    )
    or exists (
      select 1 from public.organization_member_departments d
      join public.organization_members m on m.id = d.member_id
      where m.user_id = _user_id and m.org_id = _org_id and m.status = 'active'
        and d.department_id = _department_id
    );
$$;

-- ------------------------------------------------------------------- políticas
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (public.is_org_member(auth.uid(), id));

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
  using (public.is_org_admin(auth.uid(), id))
  with check (public.is_org_admin(auth.uid(), id));

drop policy if exists org_members_select on public.organization_members;
create policy org_members_select on public.organization_members for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));

drop policy if exists org_members_admin_write on public.organization_members;
create policy org_members_admin_write on public.organization_members for all to authenticated
  using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

drop policy if exists org_member_depts_select on public.organization_member_departments;
create policy org_member_depts_select on public.organization_member_departments for select to authenticated
  using (exists (select 1 from public.organization_members m
                 where m.id = member_id and public.is_org_member(auth.uid(), m.org_id)));

drop policy if exists org_member_depts_admin_write on public.organization_member_departments;
create policy org_member_depts_admin_write on public.organization_member_departments for all to authenticated
  using (exists (select 1 from public.organization_members m
                 where m.id = member_id and public.is_org_admin(auth.uid(), m.org_id)))
  with check (exists (select 1 from public.organization_members m
                 where m.id = member_id and public.is_org_admin(auth.uid(), m.org_id)));

-- convites: só admins da própria org enxergam; o token nunca é lido pelo cliente
drop policy if exists org_invites_admin on public.organization_invites;
create policy org_invites_admin on public.organization_invites for all to authenticated
  using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

drop policy if exists org_integrations_admin on public.organization_integrations;
create policy org_integrations_admin on public.organization_integrations for all to authenticated
  using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

drop policy if exists org_integrations_read on public.organization_integrations;
create policy org_integrations_read on public.organization_integrations for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));

-- ------------------------------------------------------------ updated_at
drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_org_members_updated on public.organization_members;
create trigger trg_org_members_updated before update on public.organization_members
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_org_integrations_updated on public.organization_integrations;
create trigger trg_org_integrations_updated before update on public.organization_integrations
  for each row execute function public.update_updated_at_column();
