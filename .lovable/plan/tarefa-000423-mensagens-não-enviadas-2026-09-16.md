# Tarefa #000423: mensagens não enviadas

## O que os dados mostram

A tarefa "Admissão" foi concluída hoje às 11:51 e tem 3 documentos para o cliente, mas nada foi enviado (registro de envio vazio).

Motivo: ela foi criada **antes** da mudança para WhatsApp e ficou marcada apenas como "enviar por e-mail". Depois que o e-mail saiu do sistema, tarefas assim não disparam envio nenhum — e também não mostram o aviso "Envio pendente" no card, porque esse aviso só aparece em tarefas marcadas para WhatsApp.

Existem **7 tarefas** nessa situação (1 ainda em aberto). O contato de WhatsApp do departamento existe (47 99196-5086), então o envio é viável.

## O que fazer

1. **Regularizar as tarefas antigas**: todas as que estavam marcadas para e-mail passam a valer como envio por WhatsApp, incluindo a que ainda está em aberto — assim o envio dispara normalmente ao concluir.
2. **Enviar agora a #000423**: disparar o envio dos 3 documentos já anexados (nada foi enviado antes, então não há duplicidade).
3. **Aviso mais abrangente**: o selo "Envio pendente" com o botão Reenviar passa a aparecer em qualquer tarefa concluída que tenha envio ao cliente configurado e ainda não enviado, não só nas marcadas como WhatsApp.

## Detalhes técnicos

- Correção de dados: `UPDATE tasks SET notify_whatsapp = true, notify_email = false WHERE notify_email AND NOT notify_whatsapp` (7 linhas). Nenhum template afetado (0 legados).
- Envio da #000423 (`5f59f97f-…`) via `task-notify-client`, que já roda somente pelo ramo Evolution API.
- `src/pages/Tasks.tsx` (linhas ~319, ~330, ~760), `src/components/tasks/TaskEditDialog.tsx` (~183) e `src/components/chat/PendingTasksPanel.tsx` (~215): trocar a condição `notify_whatsapp` por `(notify_whatsapp || notify_email)` no disparo ao concluir e na exibição do selo/reenvio, evitando novos casos silenciosos.
- Sem alterações de schema, RLS ou de outras edge functions.
