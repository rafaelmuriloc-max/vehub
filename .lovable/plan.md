## Causa real

A política RLS de SELECT em `tasks` exige que o usuário seja assignee, criador ou admin:
```
((EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()))
 OR has_role(auth.uid(), 'admin')
 OR (created_by = auth.uid()))
```
Por isso o `PendingTasksPanel` não enxergava a tarefa do contato Rafael (atribuída a outro funcionário) e retornava `null`, deixando o `<aside>` vazio.

## Correção

1. **Migration RLS** — Trocar a política de SELECT em `public.tasks` para liberar leitura a todos os autenticados (igual ao padrão já usado em `clients`, `task_templates`, `task_attachments`):
   - `DROP POLICY "Users can view assigned tasks" ON public.tasks;`
   - `CREATE POLICY "Authenticated can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);`
   - Manter inalteradas as policies de INSERT/UPDATE/DELETE (continuam restritas a admin/criador/assignee).
   - Aplicar o mesmo para `task_assignments` (hoje SELECT = `user_id = auth.uid() OR admin`) → trocar por `USING (true)` para que o painel veja os assignees de qualquer tarefa.

2. **`src/pages/Chat.tsx`** — Reverter o gate para considerar a contagem novamente, agora que a contagem reflete a verdade:
   - Voltar para `pendingTasksOpen && pendingTasksCount > 0 && activeConv?.whatsappPhone`.
   - Sem isso o `<aside>` fica visível como faixa vazia em conversas sem tarefas.

3. **`src/components/chat/PendingTasksPanel.tsx`** — Remover o early-return `null` que adicionei (a responsabilidade volta ao parent via `onCountChange`).

Resultado:
- Todos os usuários autenticados veem todas as tarefas (no painel do chat, no Kanban e na lista).
- O painel "Tarefas pendentes" abre automaticamente em qualquer conversa cujo telefone bata com algum contato vinculado a clientes com tarefas em aberto.
- Permissões de criação/edição/exclusão continuam restritas (admin, criador, assignee).