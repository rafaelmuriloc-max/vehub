## Mudança
Substituir o envio WhatsApp da `task-notify-client` da Meta Cloud API para a **Evolution API**, eliminando a restrição de janela de 24h que está bloqueando as notificações.

## Arquivo afetado
`supabase/functions/task-notify-client/index.ts` (bloco `if (task.notify_whatsapp)`, ~linhas 178–226)

## Detalhes

### Texto principal
- `POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE_NAME}`
- Header `apikey: {EVOLUTION_API_KEY}`
- Body `{ number, text: signedMessage }` (mantém assinatura `*Responsável*` já montada)

### Cada anexo (`task_attachments` com `direction = 'output'`)
- Gera URL assinada do bucket `documents` (7 dias)
- `POST {EVOLUTION_API_URL}/message/sendMedia/{EVOLUTION_INSTANCE_NAME}`
- Body `{ number, mediatype: 'document'|'image', mimetype, media: signedUrl, fileName }`
- MIME inferido pela extensão (helper local, mesmo padrão de `whatsapp-send`)
- Imagens (`file_type` começando com `image/`) vão como `mediatype: image`

### Persistência
- Inserir uma linha em `whatsapp_logs` por envio bem-sucedido (texto e cada anexo) com `client_id`, `recipient_phone`, `body_text`, `wamid` (do retorno `key.id` do Evolution) e `sent_by`
- `tasks.notify_sent_at` só é marcado se algum canal (whatsapp ou email) tiver `ok: true` — comportamento atual mantido

### Logging
- `console.log` do status HTTP e do JSON retornado pelo Evolution em cada chamada, para rastrear falhas futuras

### O que NÃO muda
- Bloco de e-mail (`smtp-send`) permanece igual
- Frontend (`Tasks.tsx`, `PendingTasksPanel.tsx`) continua chamando `task-notify-client` sem alterações
- Função `whatsapp-send` e `sendActivityWhatsApp` não são tocadas
- Sem mudanças de schema; `whatsapp_logs` já aceita esses campos
- Secrets já configurados: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`

Aprove para eu implementar.
