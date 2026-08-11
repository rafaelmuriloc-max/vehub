# Tarefas notificadas que continuam na coluna "A Fazer"

## O que os dados mostram

A tarefa **#000253 — Solicitação de Holerites** teve os 3 arquivos anexados para o cliente em 10/08 às 18:59 e o envio foi registrado (`notify_sent_at` preenchido no mesmo segundo), mas o status continuou `todo`. Em 11/08 às 11:51 a tarefa foi atualizada novamente e permaneceu em "A Fazer".

Hoje ela é a **única** tarefa do banco com notificação enviada e status diferente de "Concluído" (as outras 213 estão corretas) — ou seja, o fechamento automático no servidor, implantado depois desse envio, já cobre novos casos, mas restam três brechas que deixam o card na coluna errada:

1. O painel de tarefas do chat (botão "Para o cliente") anexa o documento de saída **sem** mover o status — diferente do formulário de edição, que já promove para "Aguardando".
2. Salvar a tarefa pelo formulário/quadro regrava o status que estava carregado na tela. Se o servidor concluiu a tarefa depois que a tela abriu, o salvamento a rebaixa de volta para "A Fazer".
3. O quadro de tarefas só recarrega quando a própria tela dispara a ação; se o fechamento veio do servidor ou de outra tela, o card fica parado até recarregar a página.

## Correções

1. **Nenhum salvamento rebaixa tarefa já notificada**: ao salvar (quadro, formulário ou painel do chat), se a tarefa já tem envio registrado ela permanece "Concluído".
2. **Anexo para o cliente move a tarefa no painel do chat**, igual ao formulário: de "A Fazer" para "Aguardando".
3. **Quadro sempre atualizado**: o Kanban recarrega ao voltar o foco da janela e escuta alterações em tempo real das tarefas, para o card mudar de coluna sem recarregar a página.
4. **Correção do caso atual**: a #000253 passa a "Concluído" (envio já confirmado em 10/08).

## Detalhes técnicos

- `src/components/chat/PendingTasksPanel.tsx`: em `uploadOutput`, após inserir anexos `direction='output'` com sucesso, atualizar `status` de `todo` para `in_progress` e refletir na lista.
- `src/pages/Tasks.tsx` e `src/components/tasks/TaskEditDialog.tsx`: antes do `update`, reler `status`/`notify_sent_at` da tarefa; se `notify_sent_at` existir e o banco já estiver `done`, não gravar status inferior (manter `done` no payload e no formulário).
- `src/pages/Tasks.tsx`: `loadData()` em `visibilitychange`/`focus` + canal realtime `postgres_changes` em `public.tasks`, com `supabase.removeChannel` no cleanup do `useEffect`.
- SQL pontual: `update tasks set status='done' where notify_sent_at is not null and status <> 'done'` (afeta apenas a #000253).
- Sem alteração de schema.