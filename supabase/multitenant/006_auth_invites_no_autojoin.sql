-- ============================================================================
-- 006 — Fim do ingresso automático + convites verificados de uso único
-- NÃO APLICADO. Aplicar ANTES de habilitar o provider Google.
-- ============================================================================

-- 1) Novo usuário NÃO recebe mais papel nem acesso automático.
--    Cria apenas o perfil órfão (sem org_id), que não enxerga nada.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict do nothing;
  -- NENHUM insert em user_roles / organization_members.
  -- Acesso só é concedido pelo aceite de um convite válido.
  return new;
end $$;

-- 2) has_role legado deixa de autorizar qualquer coisa fora da organização.
--    Mantido apenas para não quebrar chamadas antigas durante a transição.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = _user_id
      and m.status = 'active'
      and m.role = _role
      and m.org_id = public.current_org_id()
  );
$$;

-- 3) Criação de convite (admin da própria organização).
--    Retorna o token BRUTO uma única vez; o banco guarda apenas o hash.
create or replace function public.create_org_invite(
  _org_id uuid, _email text, _role public.app_role default 'employee',
  _department_ids uuid[] default '{}', _valid_hours int default 72)
returns table(invite_id uuid, token text)
language plpgsql security definer set search_path = public as $$
declare v_token text; v_hash text; v_id uuid;
begin
  if not public.is_org_admin(auth.uid(), _org_id) then
    raise exception 'forbidden';
  end if;
  if _email is null or position('@' in _email) = 0 then
    raise exception 'email inválido';
  end if;
  if _valid_hours < 1 or _valid_hours > 336 then
    raise exception 'validade fora do intervalo permitido';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.organization_invites
    (org_id, invited_email, role, department_ids, token_hash, expires_at, created_by)
  values (_org_id, lower(trim(_email)), _role, coalesce(_department_ids,'{}'),
          v_hash, now() + make_interval(hours => _valid_hours), auth.uid())
  returning id into v_id;

  return query select v_id, v_token;
end $$;

revoke all on function public.create_org_invite(uuid, text, public.app_role, uuid[], int) from public, anon;
grant execute on function public.create_org_invite(uuid, text, public.app_role, uuid[], int) to authenticated;

-- 4) Aceite do convite — exige sessão autenticada com e-mail verificado
--    pelo próprio provedor (Supabase). Não há vínculo manual por e-mail:
--    o e-mail comparado é o do JWT, provado pelo fluxo oficial de login.
create or replace function public.accept_org_invite(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  inv public.organization_invites%rowtype;
  v_email text;
  v_verified boolean;
  v_member uuid;
  claims jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_email := lower(coalesce(claims ->> 'email', ''));
  v_verified := coalesce((claims -> 'user_metadata' ->> 'email_verified')::boolean, false)
             or coalesce((claims ->> 'email_verified')::boolean, false);

  if v_email = '' then raise exception 'sessão sem e-mail'; end if;
  if not v_verified then
    -- contas criadas por admin com email_confirm=true não bastam: exigimos
    -- prova de controle vinda do provedor da sessão atual.
    raise exception 'e-mail não verificado nesta sessão';
  end if;

  v_hash := encode(digest(_token, 'sha256'), 'hex');

  select * into inv from public.organization_invites
   where token_hash = v_hash for update;

  if inv.id is null then raise exception 'convite inválido'; end if;
  if inv.revoked_at is not null then raise exception 'convite revogado'; end if;
  if inv.accepted_at is not null then raise exception 'convite já utilizado'; end if;
  if inv.expires_at <= now() then raise exception 'convite expirado'; end if;
  if lower(inv.invited_email) <> v_email then raise exception 'convite emitido para outro e-mail'; end if;

  insert into public.organization_members (org_id, user_id, role, status)
  values (inv.org_id, auth.uid(), inv.role, 'active')
  on conflict (org_id, user_id)
    do update set status = 'active', role = excluded.role, removed_at = null
  returning id into v_member;

  if array_length(inv.department_ids, 1) is not null then
    insert into public.organization_member_departments (member_id, department_id)
    select v_member, unnest(inv.department_ids)
    on conflict do nothing;
  end if;

  update public.profiles set org_id = inv.org_id
   where user_id = auth.uid() and org_id is null;

  update public.organization_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where id = inv.id;

  return inv.org_id;
end $$;

revoke all on function public.accept_org_invite(text) from public, anon;
grant execute on function public.accept_org_invite(text) to authenticated;

-- 5) Remoção de membro: apenas desativa o vínculo NAQUELA organização.
--    Nunca apaga a conta global em auth.users.
create or replace function public.remove_org_member(_org_id uuid, _user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_admin(auth.uid(), _org_id) then raise exception 'forbidden'; end if;
  if _user_id = auth.uid() then raise exception 'não é possível remover a si mesmo'; end if;

  update public.organization_members
     set status = 'removed', removed_at = now()
   where org_id = _org_id and user_id = _user_id;

  delete from public.organization_member_departments d
   using public.organization_members m
   where d.member_id = m.id and m.org_id = _org_id and m.user_id = _user_id;
end $$;

revoke all on function public.remove_org_member(uuid, uuid) from public, anon;
grant execute on function public.remove_org_member(uuid, uuid) to authenticated;

-- 6) Organizações do usuário logado (para o seletor de escritório)
create or replace function public.my_organizations()
returns table(org_id uuid, name text, slug text, role public.app_role)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.slug, m.role
  from public.organization_members m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and m.status = 'active'
  order by o.name;
$$;

grant execute on function public.my_organizations() to authenticated;
