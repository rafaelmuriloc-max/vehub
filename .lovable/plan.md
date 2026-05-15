## Objetivo

Replicar no `PendingTasksPanel` o fluxo de notificação ao cliente (WhatsApp/E-mail) que o Kanban executa quando uma tarefa é movida para "Concluído".

## Comportamento atual no Kanban (`src/pages/Tasks.tsx`)

`moveTask` → ao mudar status para `done` (vindo de outro status), se a tarefa tem `notify_whatsapp || notify_email` e ainda não foi notificada (`notify_sent_at IS NULL`), chama `triggerNotify(taskId)` que invoca a edge function `task-notify-client` e mostra toast com o resultado (WhatsApp/E-mail enviado ou erro).

## Mudanças

### `src/components/chat/PendingTasksPanel.tsx`

1. Carregar campos extras das tarefas: `notify_whatsapp`, `notify_email`, `notify_sent_at` (acrescentar ao `select` de `tasks` e ao tipo `TaskRow`).
2. Em `moveTask(taskId, newStatus)`:
   - Antes do `UPDATE`, capturar a tarefa local (`prev`).
   - Após `UPDATE` bem-sucedido, se `newStatus === 'done'` e `prev.status !== 'done'` e (`prev.notify_whatsapp || prev.notify_email`) e `!prev.notify_sent_at`, invocar `supabase.functions.invoke('task-notify-client', { body: { taskId } })`.
   - Tratar resposta com toasts iguais ao Kanban (WhatsApp ok/erro, E-mail ok/erro, "Cliente notificado" / "Falha ao notificar cliente"), com `try/catch` para erros inesperados.
3. Manter remoção da tarefa da lista local quando sai de `todo` (comportamento já existente).

### Sem mudanças em
- Edge function `task-notify-client` (já existe e é a mesma usada pelo Kanban).
- Schema do banco.
- `src/pages/Chat.tsx` ou `MessageArea.tsx`.

## Notas

- Como o painel só mostra tarefas com status `todo`, o caminho relevante é `todo → done` (botão "→ Concluído"). Para `todo → in_progress` (botão "→ Aguardando") não há notificação, igual ao Kanban.
- Reutilizar mesmas mensagens de toast em pt-BR para consistência com o Kanban.