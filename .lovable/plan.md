## Envio automático ao concluir tarefa

Adicionar opções de envio por WhatsApp e/ou e-mail ao cliente quando a tarefa for marcada como **Concluída**, anexando os arquivos da seção "Para enviar ao cliente" (output).

### Banco (`tasks`)

Novas colunas:
- `notify_whatsapp boolean not null default false`
- `notify_email boolean not null default false`
- `notify_message text` — texto único usado tanto no WhatsApp quanto no corpo do e-mail
- `notify_email_subject text` — assunto do e-mail (opcional, padrão "Documentos da tarefa: {título}")
- `notify_sent_at timestamptz` — preenchido após envio para evitar reenvios

Não há mudança em RLS (políticas atuais já cobrem).

### `src/pages/Tasks.tsx` — Diálogo de cadastro/edição

Adicionar uma seção "Notificar cliente ao concluir":
- Switch **Enviar por WhatsApp**
- Switch **Enviar por E-mail**
- Quando qualquer um estiver ativo, mostra:
  - Campo **Mensagem** (Textarea) — texto livre, usado nos dois canais.
  - Se e-mail estiver ativo, campo **Assunto do e-mail**.
- Aviso visual: "Os arquivos da aba 'Para enviar ao cliente' serão anexados ao envio."

O `form` ganha campos `notify_whatsapp`, `notify_email`, `notify_message`, `notify_email_subject`, persistidos junto no insert/update.

### Disparo do envio

Quando o usuário muda status da tarefa para `done` (no card via drag/drop OU no diálogo de edição):
- Se `notify_sent_at` ainda for null e (`notify_whatsapp` ou `notify_email`):
  - Buscar anexos `direction='output'` da tarefa.
  - Buscar contato do cliente (telefone/e-mail). Para e-mail usa `client_department_contacts` se houver `department_id`, fallback `clients.contact_email`. Mesmo para telefone.
  - **WhatsApp**: chama edge function `whatsapp-send-text` com a mensagem e, para cada anexo output, `whatsapp-send-media` com URL assinada do storage `documents`.
  - **E-mail**: chama `smtp-send` passando `departmentId` da tarefa (ou primeiro departamento disponível como fallback), `to`, `subject`, `html` (mensagem com quebras `<br>`) e `attachments` no formato esperado (`{fileUrl, fileName}` apontando para o path no bucket `documents`).
  - Atualiza `notify_sent_at = now()` na tarefa.
- Toast informa sucesso/erro de cada canal.

### Detalhes técnicos

- A função `smtp-send` já aceita `attachments: [{fileUrl, fileName}]` baixando do bucket `documents` — usar o path relativo armazenado em `task_attachments.file_url`.
- Não criar nenhuma edge function nova; reaproveitar `whatsapp-send-text`, `whatsapp-send-media` e `smtp-send`.
- Sem template Meta API (mensagem livre); WhatsApp text só funciona dentro da janela de 24h ou para grupos — manter assim mesmo, mostrar erro do gateway no toast se ocorrer.
- Se a tarefa não tiver `department_id`, exigir seleção (ou desabilitar e-mail) — mostrar mensagem clara no diálogo.

### Fora de escopo

- Reenvio manual (botão dedicado) — pode ser adicionado depois reaproveitando a mesma rotina e zerando `notify_sent_at`.
- Logs persistidos (já há `email_logs` e `whatsapp_logs` populados pelas edge functions).
