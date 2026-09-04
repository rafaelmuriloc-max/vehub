# Data de criação e conclusão nos cards do Kanban

Mostrar nos cards de tarefas do Kanban a data/hora de criação (já existe como "Solicitado em") e a data/hora de conclusão.

## O que vai mudar

- Cada card do Kanban (colunas A Fazer / Aguardando / Concluído) passa a exibir:
  - **Solicitado em** data e hora — já existe, mantido.
  - **Concluído em** data e hora — exibido apenas quando a tarefa está concluída.
- A data de conclusão passa a ser registrada automaticamente sempre que uma tarefa for marcada como "Concluído", não importa por onde (Kanban, Lista, painel do chat, diálogo de edição).
- Tarefas já concluídas hoje recebem uma data aproximada (a última atualização registrada) para não ficarem sem informação.

## Detalhes técnicos

1. **Migration** em `tasks`:
   - Nova coluna `completed_at timestamptz` (nula por padrão).
   - Trigger `trg_tasks_completed_at` BEFORE UPDATE: quando `status` muda para `'done'`, grava `completed_at = now()`; quando sai de `'done'`, limpa para `null`.
   - Backfill: `UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL`.
2. **Frontend** (`src/pages/Tasks.tsx`):
   - Adicionar `completed_at?: string | null` ao tipo `Task`.
   - No card do Kanban, abaixo de "Solicitado em", exibir `Concluído em {formatDateTime(task.completed_at)}` quando `task.status === 'done' && task.completed_at`.
3. Nenhuma outra mudança de comportamento; o trigger garante o preenchimento mesmo nas ações fora da página de Tarefas (painel do chat, TaskEditDialog).
