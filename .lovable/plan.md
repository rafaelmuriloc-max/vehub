## Objetivo

Restringir a visualização de obrigações e atividades por departamento do usuário:

- Usuário **com `department_id` definido** no perfil → vê apenas obrigações/atividades/instâncias do seu departamento.
- Usuário **sem `department_id`** (em branco) → vê de todos os departamentos (comportamento atual).
- **Admin** → sempre vê tudo (mantido).

## Como será implementado

A regra será aplicada via **RLS no banco** (não só no frontend), garantindo que um usuário sem permissão não consiga ler dados de outros departamentos nem mesmo via API direta.

### 1. Função auxiliar (SECURITY DEFINER)

Cria `public.user_can_access_department(_user_id uuid, _department_id uuid)`:
- Retorna `true` se o usuário é admin.
- Retorna `true` se `profiles.department_id` do usuário é `NULL`.
- Retorna `true` se `profiles.department_id = _department_id`.
- Caso contrário, `false`.

Usar SECURITY DEFINER + `set search_path = public` para evitar recursão de RLS na tabela `profiles`.

### 2. Políticas RLS atualizadas (apenas SELECT)

Tabelas afetadas e nova regra de SELECT:

| Tabela | Filtro |
|---|---|
| `obligations` | `user_can_access_department(auth.uid(), department_id)` |
| `obligation_instances` | departamento da obrigação correspondente |
| `obligation_activities` | departamento da obrigação correspondente |
| `obligation_activity_completions` | departamento da obrigação da atividade |
| `client_department_obligations` | `user_can_access_department(auth.uid(), department_id)` |

Políticas de INSERT/UPDATE/DELETE **permanecem como estão** (continuam restritas a admin), pois admins não são afetados pelo filtro.

### 3. Frontend

Nenhuma alteração necessária. As listas em **Obrigações**, **Calendário**, **Tasks**, **Email**, e a aba **Obrigações** dentro do cliente passarão a exibir somente os itens do departamento do usuário automaticamente, porque as queries usam o cliente Supabase autenticado e respeitam RLS.

### 4. Pontos a confirmar

- A tela **Cadastro de Usuário** já permite vincular `department_id` ao perfil? Se não, será preciso adicionar esse campo no formulário (UsersTab) — me confirme se devo incluir essa parte no plano.

## Resumo

Migração SQL adicionando uma função `user_can_access_department` e substituindo apenas as policies de SELECT das 5 tabelas listadas. Sem mudanças de código no frontend.
