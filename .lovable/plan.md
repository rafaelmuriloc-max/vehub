## Objetivo
Permitir excluir uma tarefa diretamente do card no Kanban e da linha na visão de lista em `/tasks`.

## Mudanças em `src/pages/Tasks.tsx`

1. **Nova função `deleteTask(id)`**
   - Confirmação: "Excluir esta tarefa? Esta ação não pode ser desfeita."
   - Apaga dependências antes da tarefa para evitar erro de FK:
     - `task_attachments` (where `task_id = id`)
     - `task_assignments` (where `task_id = id`)
   - `supabase.from('tasks').delete().eq('id', id)`
   - Toast de sucesso/erro e `loadTasks()`.

2. **Botão no card do Kanban**
   - Ícone `Trash2` (variant `ghost`, size `icon`, `h-7 w-7`) ao lado do botão de editar já existente no card.
   - `onClick` chama `deleteTask(task.id)` com `e.stopPropagation()` para não disparar o drag/abrir edição.

3. **Botão na visão lista**
   - Na coluna de ações de cada linha, adicionar `Trash2` ao lado do botão editar, mesmo handler.

## Observações
- Apenas exclusão da instância de `tasks` (não mexe no `task_templates`).
- Sem mudanças de schema, edge functions ou RLS.
