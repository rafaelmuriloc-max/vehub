-- ============================================================================
-- 005 — Storage por organização SEM mover os 16.271 arquivos existentes
-- NÃO APLICADO.
-- Estratégia: prefixo "{org_id}/..." para arquivos NOVOS; caminhos legados
-- (sem prefixo de organização) são mapeados exclusivamente à organização
-- existente, preservando todos os links já emitidos.
-- ============================================================================

-- organização dona dos caminhos legados (uma única, definida no backfill)
create or replace function public.legacy_storage_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.organizations where slug = 'escritorio-principal';
$$;

-- resolve a organização de um objeto a partir do caminho
create or replace function public.storage_object_org(_name text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare first_seg text; v_org uuid;
begin
  first_seg := split_part(_name, '/', 1);
  begin
    v_org := first_seg::uuid;
  exception when others then
    return public.legacy_storage_org_id();   -- caminho legado
  end;
  if exists (select 1 from public.organizations where id = v_org) then
    return v_org;
  end if;
  return public.legacy_storage_org_id();
end $$;

do $$
declare
  b text;
  buckets text[] := array['certificates','chat-media','documents','email-attachments'];
  p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'org_%' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;

  foreach b in array buckets loop
    execute format($f$
      create policy %I on storage.objects for select to authenticated
        using (bucket_id = %L
               and public.is_org_member(auth.uid(), public.storage_object_org(name)))
    $f$, 'org_read_' || replace(b,'-','_'), b);

    -- gravação SEMPRE com prefixo da organização ativa: nada novo cai no legado
    execute format($f$
      create policy %I on storage.objects for insert to authenticated
        with check (bucket_id = %L
               and public.current_org_id() is not null
               and name like public.current_org_id()::text || '/%%')
    $f$, 'org_write_' || replace(b,'-','_'), b);

    execute format($f$
      create policy %I on storage.objects for update to authenticated
        using (bucket_id = %L
               and public.is_org_member(auth.uid(), public.storage_object_org(name)))
        with check (bucket_id = %L
               and public.is_org_member(auth.uid(), public.storage_object_org(name)))
    $f$, 'org_update_' || replace(b,'-','_'), b, b);

    execute format($f$
      create policy %I on storage.objects for delete to authenticated
        using (bucket_id = %L
               and public.is_org_admin(auth.uid(), public.storage_object_org(name)))
    $f$, 'org_delete_' || replace(b,'-','_'), b);
  end loop;
end $$;

-- Observação: o bucket público `chat-media` continua público para leitura
-- anônima por URL direta (comportamento atual, links já divulgados).
-- Tornar privado é uma decisão separada, documentada em docs/multi-tenant.md.
