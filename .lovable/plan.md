# Envio dos documentos das tarefas #000434 e #000435 (somente WhatsApp)

## O que os dados mostram

As duas tarefas foram concluídas hoje (12:11 e 12:12) e têm anexos para o cliente (4 e 2 arquivos), mas o registro de envio está vazio nas duas.

Elas estavam configuradas para enviar **por e-mail**, e o Gmail do Depto Pessoal recusou a conexão nas duas tentativas:

```text
535 5.7.8 Username and Password not accepted (BadCredentials)
```

Por isso nada chegou ao cliente. O contato de WhatsApp do departamento existe (47 99202-1320), então o envio por WhatsApp é viável.

## O que fazer

1. **Passar os envios ao cliente para WhatsApp**: nas tarefas e nos modelos de tarefa, o canal padrão passa a ser WhatsApp; o e-mail deixa de ser usado no envio dos documentos ao cliente.
2. **Corrigir as duas tarefas**: trocar o canal delas para WhatsApp e reenviar os documentos já anexados (nada foi enviado, então não há duplicidade).
3. **Deixar a falha visível**: se o envio falhar, a tarefa mostra um aviso claro com o motivo e um indicador de "envio pendente" no card, com botão para reenviar — hoje a tarefa é marcada como concluída mesmo quando o envio falha.

## Detalhes técnicos

- Causa confirmada em `smtp-send` (erro 535 do Gmail); `task-notify-client` rodou normalmente e não gravou `notify_sent_at` por ausência de canal bem-sucedido.
- `src/pages/Tasks.tsx`, `src/components/tasks/TaskEditDialog.tsx`, `src/components/chat/TaskRequestForm.tsx`: remover a opção de e-mail do envio ao cliente (campos `notify_email`/`notify_email_subject`) deixando apenas WhatsApp; novas tarefas/modelos nascem com `notify_whatsapp = true`.
- `supabase/functions/task-notify-client/index.ts`: manter apenas o ramo Evolution API (WhatsApp) e remover a chamada ao `smtp-send`.
- `src/pages/Tasks.tsx`: em `moveTask`, mostrar `result.whatsapp.error` quando houver falha; badge "Envio pendente" nos cards concluídos com `notify_sent_at` nulo e ação de reenvio.
- Correção pontual de dados: nas tarefas 434 e 435, definir `notify_whatsapp = true`, `notify_email = false`, e reenviar.
- Sem alterações de schema, RLS ou de outras funções.
