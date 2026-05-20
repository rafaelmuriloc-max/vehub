## Objetivo

Hoje cada usuário tem apenas um departamento (`profiles.department_id`). Vamos permitir vincular o usuário a **vários departamentos** ou a **todos** (acesso irrestrito).

## Regra de negócio

- Lista vazia de departamentos = **acesso a todos** (mantém o comportamento atual de `department_id NULL`).
- Lista com 1+ departamentos = acesso somente àqueles.
- Admin continua vendo tudo, independente da vinculação.

## Banco de dados (migration)

1. Nova tabela `profile_departments`:
   - `user_id uuid` + `department_id uuid` (PK composta)
   - RLS: SELECT para autenticados; INSERT/UPDATE/DELETE só para admin.
2. Backfill: copiar `profiles.department_id` atual (quando não-nulo) para `profile_departments`.
3. Atualizar a função `user_can_access_department(_user_id, _department_id)`:
   - Admin → true
   - `_department_id` nulo → true
   - Sem nenhuma linha em `profile_departments` para o usuário → true (= "todos")
   - Caso contrário → true só se existir linha `(user_id, department_id)`.
4. Manter `profiles.department_id` por compatibilidade como "departamento principal" (opcional, usado em locais que ainda dependem dele, ex.: `TaskRequestForm`, `ImportSetupDialog`, round-robin do `chat-triage-agent`). Será preenchido com o primeiro departamento selecionado (ou null para "todos").

## UI – `src/components/settings/UsersTab.tsx`

- Substituir o `Select` único de "Departamento" por um seletor múltiplo (popover + checkboxes) com:
  - Checkbox "Todos os departamentos" (limpa a seleção e desabilita os demais).
  - Lista de departamentos com checkbox.
- Na tabela de usuários, coluna "Departamento" passa a mostrar:
  - "Todos" se vazio
  - Nome único se 1
  - "Fiscal, Contábil +2" se vários (com tooltip listando todos).
- Carregar `profile_departments` no `fetchData` e gravar diff (insert/delete) ao salvar (edit) ou após criar (create).

## Edge function – `supabase/functions/manage-user/index.ts`

- Aceitar `department_ids: string[]` (além de manter `department_id` por compat).
- Em `create`/`update`: substituir as linhas de `profile_departments` do usuário pelo novo conjunto. Atualizar `profiles.department_id` com o primeiro item (ou null).

## Impacto em código existente

Sem mudanças funcionais necessárias nos componentes que leem `profiles.department_id` (Tasks, ImportSetup, triage round-robin). Eles continuam funcionando com o "departamento principal". Apenas a RLS via `user_can_access_department` passa a respeitar a lista completa.

## Fora de escopo

- Não mexer no fluxo de triagem da Gisele agora (round-robin continua usando `department_id` principal).
- Não mexer em outras telas além de Configurações → Usuários.
