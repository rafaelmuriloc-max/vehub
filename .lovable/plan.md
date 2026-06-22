## Problema

No seletor "Atendente padrão" do bloco *Transferência direta*, só aparecem os usuários explicitamente vinculados ao departamento via `profile_departments`. Pela regra do `user_can_access_department`, usuários **sem nenhum vínculo em `profile_departments`** têm acesso a todos os departamentos — mas hoje eles não aparecem na lista.

## Solução

Em `src/components/settings/CompanyTab.tsx`, quando `directDept` muda, buscar a lista de atendentes assim:

1. `select user_id from profile_departments` → conjunto de `user_ids_com_vinculo`.
2. `select user_id from profile_departments where department_id = directDept` → `user_ids_no_dept`.
3. `select user_id, full_name from profiles` → todos os profiles.
4. Filtrar: incluir o profile se `user_ids_no_dept.has(user_id)` **ou** `!user_ids_com_vinculo.has(user_id)` (acesso a todos).
5. Ordenar por nome e preencher o select. Manter a limpeza de `directUser` se ele não estiver mais na lista.

A mensagem de "nenhum atendente vinculado" só aparece quando o filtro acima resulta em zero (já cobrindo os dois casos).

Nenhuma alteração de banco, edge function ou tipos.
