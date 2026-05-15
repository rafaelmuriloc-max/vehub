## Objetivo
Adicionar uma aba **"Cadastro"** dentro de `/tasks` para registrar modelos de tarefas pontuais por departamento. As tarefas cadastradas aparecem como atalho/templates que, quando solicitadas, criam um card no Kanban existente.

## Mudanças no banco

1. Nova tabela `task_templates`:
   - `name` (texto)
   - `department_id` (uuid → departments)
   - `description` (texto)
   - `default_due_days` (int) — quantos dias para entrega a partir da solicitação
   - RLS: admin gerencia (insert/update/delete); todos autenticados visualizam.

2. Adicionar coluna `department_id` (uuid, nullable) e `template_id` (uuid, nullable) à tabela `tasks` para vincular tarefas instanciadas ao template e departamento.

## Mudanças no frontend

### `src/pages/Tasks.tsx`
- Envolver conteúdo em `Tabs` com 3 abas: **Quadro**, **Lista**, **Cadastro** (Quadro+Lista podem ficar como sub-toggle como já está, ou virar tabs também — opção mais simples: tabs no topo `Tarefas` (atual) e `Cadastro de Tarefas`).
- Aba **Cadastro**:
  - Listagem de templates agrupados/filtráveis por departamento (Tabela: Nome, Departamento, Prazo padrão, Ações).
  - Botão "Nova tarefa" → Dialog com campos: Nome, Departamento (select), Descrição (textarea), Prazo de entrega (dias, número).
  - Editar/Excluir templates (somente admin).
  - Botão "Solicitar" em cada template abre dialog rápido para escolher: Cliente (Combobox obrigatório), Responsável (multi-select opcional — vazio = livre para departamento), data de entrega (pré-preenchida com hoje + `default_due_days`). Ao confirmar, cria registro em `tasks` (status `todo`) + `task_assignments` se houver responsáveis. A tarefa criada já aparece no Kanban da aba Quadro.

### Card do Kanban
- Mostrar badge do departamento quando `department_id` presente.

## Permissões / regras
- Cliente é **obrigatório** ao solicitar uma tarefa a partir do template.
- Responsável é opcional (deixar vazio = qualquer um do departamento pode pegar).
- Apenas admin cria/edita/exclui templates; qualquer autenticado pode "Solicitar" (criar instância).

## Fora do escopo
- Não criar atividades/checklists nos templates (diferente das obrigações).
- Não há geração em lote nem recorrência — são solicitações pontuais.
- Sem migração de tarefas existentes.