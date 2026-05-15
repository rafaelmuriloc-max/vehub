## Objetivo

Replicar no card do `PendingTasksPanel` (painel direito da conversa) todas as opções do card do quadro Kanban em `src/pages/Tasks.tsx`.

## Opções do card Kanban a portar

1. Título da tarefa
2. Badge de prioridade com as mesmas cores (`priorityColors`/`priorityLabels`)
3. Data de vencimento com coloração por urgência (`getDueDateColor`)
4. Nome do cliente
5. Lista de responsáveis em badges
6. Botões "→ Aguardando" e "→ Concluído" para mover status (apenas para `todo`/`in_progress`)
7. Contadores de anexos (input — `Paperclip`; output — `Upload` em `text-primary`)
8. Botão/label "Para o cliente" com `<input type="file" multiple>` para upload de anexos `direction='output'`
9. Botão excluir (lixeira `text-destructive`)
10. Card clicável para abrir o registro completo

## Implementação

### `src/components/chat/PendingTasksPanel.tsx`

- Importar `Card`, `CardContent`, `Badge`, `Button` e ícones `Paperclip`, `Upload`, `Trash2` (lucide).
- Carregar dados extras junto às tarefas:
  - `task_assignments(user_id)` → já existe.
  - Anexos: `supabase.from('task_attachments').select('task_id, direction').in('task_id', taskIds)` e agregar em `attachmentCounts: Record<id, {input, output}>`.
- Manter a lookup `profileMap` (nomes dos responsáveis).
- Constantes locais reaproveitadas do Tasks.tsx (cópia simples, sem refator):
  - `priorityColors`, `priorityLabels`, `statusLabels`, `statusColumns`, `getDueDateColor`.
- Funções locais:
  - `moveTask(taskId, newStatus)`: `update tasks.status` e refetch local; quando muda para fora de `todo`, remover da lista (o painel só mostra `todo`).
  - `uploadOutput(taskId, FileList)`: replicar lógica de `uploadCardOutputFiles` (sanitização NFD/_, path `tasks/{taskId}/{ts}_{safe}`, bucket `documents`, insert `task_attachments` com `direction:'output'`, `uploaded_by: user.id`); atualizar contador local.
  - `deleteTask(taskId)`: `confirm()` + `delete from tasks` + refetch.
- Layout do card idêntico ao Kanban:
  - clique no card abre `/tasks?id={id}` em nova aba (mantém comportamento atual; o quadro abre dialog interno, mas no chat não há esse dialog disponível).
  - `e.stopPropagation()` em todos os botões/inputs internos.
- Manter cabeçalho atual do painel (título "Tarefas pendentes" + contador + X).

### Sem mudanças em `src/pages/Chat.tsx`, MessageArea ou schema

- O painel já recebe `phone` e `onClose`; nenhuma prop nova necessária.
- `useAuth()` para obter `user.id` no upload (já disponível via hook).

## Notas

- Botões de mover status seguem `statusColumns.filter(s => s !== 'todo').slice(0,2)` → mostram "→ Aguardando" e "→ Concluído".
- Após mover/excluir, atualizar `tasks` local e propagar `onCountChange` com novo total.
- Cores de prioridade e urgência mantidas idênticas ao Kanban (não trocar por tokens semânticos para garantir paridade visual exata, conforme pedido).