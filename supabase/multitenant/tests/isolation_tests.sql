-- ============================================================================
-- Testes de isolamento entre organizações — executar em banco de teste/staging,
-- NUNCA em produção. Cada bloco falha com exception se o isolamento quebrar.
-- Uso: psql "$STAGING_DB_URL" -f supabase/multitenant/tests/isolation_tests.sql
-- ============================================================================

begin;

-- ------------------------------------------------------------------ fixtures
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111','Org A','org-a'),
  ('22222222-2222-2222-2222-222222222222','Org B','org-b')
on conflict do nothing;

-- usuários fictícios (em staging use auth.users reais)
insert into public.organization_members (org_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','admin'),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','employee'),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001','admin')
on conflict do nothing;

insert into public.clients (id, org_id, company_name, status) values
  ('aaaa0001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cliente A','active'),
  ('bbbb0001-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Cliente B','active')
on conflict do nothing;

-- helper: simula uma sessão autenticada
create or replace function pg_temp.as_user(_uid uuid, _org uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role','authenticated','email', _uid || '@test.local',
      'email_verified', true,
      'app_metadata', json_build_object('org_id', _org))::text, true);
end $$;

-- ------------------------------------- 1. isolamento entre duas organizações
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.clients;
  if n <> 1 then raise exception 'FALHA 1a: membro da Org A vê % clientes (esperado 1)', n; end if;

  select count(*) into n from public.clients where org_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FALHA 1b: Org A enxergou dados da Org B'; end if;
  raise notice 'OK 1 — isolamento entre organizações';
end $$;

-- ------------------------------------------------- 2. acesso direto por API
-- (mesma superfície do PostgREST: role authenticated + RLS)
do $$
declare ok boolean := false;
begin
  perform pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222');
  begin
    insert into public.clients (id, org_id, company_name, status)
    values (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','Invasor','active');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALHA 2: Org B conseguiu inserir cliente na Org A'; end if;
  raise notice 'OK 2 — insert cross-tenant bloqueado';
end $$;

-- --------------------------------------------------------- 3. membro removido
do $$
declare n int;
begin
  perform set_config('role','postgres', true);
  update public.organization_members set status = 'removed', removed_at = now()
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';

  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.clients;
  if n <> 0 then raise exception 'FALHA 3: membro removido ainda vê % registros', n; end if;

  perform set_config('role','postgres', true);
  update public.organization_members set status = 'active', removed_at = null
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  raise notice 'OK 3 — membro removido perde acesso';
end $$;

-- --------------------------------------------- 4. elevação de privilégio
do $$
declare ok boolean := false; n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111');
  -- funcionário tentando virar admin
  begin
    update public.organization_members set role = 'admin'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
    get diagnostics n = row_count;
    if n = 0 then ok := true; end if;
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALHA 4a: funcionário se promoveu a admin'; end if;

  -- admin da Org A tentando agir na Org B
  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
  if public.is_org_admin('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222') then
    raise exception 'FALHA 4b: admin da Org A é admin na Org B';
  end if;
  raise notice 'OK 4 — sem elevação de privilégio';
end $$;

-- ------------------------------------------- 5. relacionamento cross-tenant
do $$
declare ok boolean := false;
begin
  perform set_config('role','postgres', true);
  begin
    insert into public.tasks (id, org_id, client_id, title, status)
    values (gen_random_uuid(),'11111111-1111-1111-1111-111111111111',
            'bbbb0001-0000-0000-0000-000000000001','cruzada','todo');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALHA 5: tarefa da Org A aceitou cliente da Org B'; end if;
  raise notice 'OK 5 — relacionamento cross-tenant bloqueado';
end $$;

-- ------------------------------------------------------ 6. storage legado
do $$
declare v uuid;
begin
  v := public.storage_object_org('documentos/2026/arquivo.pdf');
  if v is distinct from public.legacy_storage_org_id() then
    raise exception 'FALHA 6a: caminho legado não mapeou para a organização existente';
  end if;
  v := public.storage_object_org('22222222-2222-2222-2222-222222222222/x.pdf');
  if v <> '22222222-2222-2222-2222-222222222222' then
    raise exception 'FALHA 6b: prefixo de organização não reconhecido';
  end if;
  raise notice 'OK 6 — mapeamento de caminhos de storage';
end $$;

-- --------------------------------------------- 7. convite de uso único
do $$
declare tok text; iid uuid; ok boolean := false;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
  select invite_id, token into iid, tok
  from public.create_org_invite('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000000009@test.local','employee','{}',72);

  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111');
  perform public.accept_org_invite(tok);
  begin
    perform public.accept_org_invite(tok);   -- segundo uso deve falhar
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALHA 7: convite aceito duas vezes'; end if;
  raise notice 'OK 7 — convite de uso único';
end $$;

-- ------------------------------------------------ 8. convite expirado/e-mail
do $$
declare tok text; iid uuid; ok boolean := false;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
  select invite_id, token into iid, tok
  from public.create_org_invite('11111111-1111-1111-1111-111111111111',
       'destinatario@test.local','employee','{}',72);

  perform pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111');
  begin
    perform public.accept_org_invite(tok);   -- e-mail diferente do convite
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALHA 8: convite aceito por e-mail diferente'; end if;
  raise notice 'OK 8 — convite vinculado ao e-mail verificado';
end $$;

rollback;   -- nada é persistido
