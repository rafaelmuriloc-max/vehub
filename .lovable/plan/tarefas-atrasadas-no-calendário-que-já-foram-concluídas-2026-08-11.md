# Tarefas atrasadas no calendário que já foram concluídas

## O que os dados mostram

A tarefa "Emitir Nota Fiscal" da **EDSON JOSE KOSKUR (#000239, venc. 08/08)** está com status **A fazer** no banco. Seus 2 anexos são de **entrada** (áudio e foto enviados pelo cliente) — não há documento de saída nem notificação registrada. A tarefa **#000241** da mesma empresa está sem anexo nenhum.

Ou seja: a nota foi emitida na prática, mas a tarefa nunca foi fechada no sistema. O calendário está mostrando o status real. Nas outras tarefas de Nota Fiscal do mesmo período o padrão é claro: quando o retorno é enviado ao cliente pelo sistema, a tarefa fica "Concluída"; quando o envio é feito por fora, ela fica aberta para sempre.

Também confirmei que o card "Atrasadas" do topo conta apenas obrigações — tarefas aparecem só na lista do dia, com o status cru em inglês ("todo"), sem nenhum destaque de atraso.

## Correções

1. **Fechar automaticamente ao notificar o cliente**: quando o envio ao cliente (WhatsApp/e-mail) da tarefa for bem-sucedido, a tarefa passa a "Concluída" pelo próprio servidor — nenhum envio bem-sucedido deixa tarefa aberta, mesmo se a tela for fechada no meio.
2. **Anexo de retorno move a tarefa**: ao anexar um documento de saída (a nota emitida), a tarefa vai para "Em revisão" automaticamente, sinalizando que falta só o envio. Não fecha sozinha, para evitar conclusão indevida.
3. **Calendário mais claro**: tarefas com vencimento passado e não concluídas ganham destaque vermelho e o rótulo "Atrasada"; os status passam a aparecer em português (A fazer / Em andamento / Em revisão / Concluída); tarefas concluídas mostram data e hora de conclusão, como já acontece nas obrigações.
4. **Concluir direto do calendário**: botão de check no card da tarefa para marcar como concluída sem abrir o formulário.
5. **Limpeza das tarefas antigas**: painel "Tarefas atrasadas" no calendário listando as tarefas vencidas ainda abertas, com seleção múltipla e conclusão em lote — para zerar casos como o #000239 e #000241.

## Detalhes técnicos

- `supabase/functions/task-notify-client/index.ts`: junto do `notify_sent_at`, atualizar `status = 'done'` quando não houver erro de envio.
- `src/components/tasks/TaskEditDialog.tsx`: ao inserir `task_attachments` com `direction = 'output'`, promover `status` de `todo` para `in_review` (sem rebaixar tarefas já concluídas).
- `src/pages/CalendarView.tsx`: no bloco de tarefas do dia, calcular `atrasada = due_date < hoje && status !== 'done'` para aplicar borda/badge vermelhos; mapa de rótulos pt-BR para `task_status`; botão de check chamando `update({ status: 'done' })` + `loadData()`; novo bloco de tarefas atrasadas do mês com checkboxes e update em lote via `.in('id', ids)`.
- Sem alterações de banco: `tasks.status` e `due_date` já suportam tudo isso.