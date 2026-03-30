

# Enviar anexos junto com e-mail das obrigações

## Resumo
Quando uma atividade de e-mail for disparada (automática ou manual), o sistema coletará todos os arquivos já anexados nas atividades anteriores (tipo documento) da mesma instância e os enviará como anexos no e-mail via SMTP.

## Mudanças

### 1. `src/lib/sendActivityEmail.ts` — coletar arquivos das atividades concluídas
- Buscar todas as `obligation_activity_completions` da mesma `instance_id` que possuam `file_url` preenchido
- Enviar a lista de `file_url` + `file_name` (extraído do path) no body da chamada à Edge Function `smtp-send`

### 2. `supabase/functions/smtp-send/index.ts` — baixar e anexar arquivos
- Receber campo opcional `attachments: Array<{ fileUrl: string, fileName: string }>` no body
- Para cada anexo, usar o Supabase Admin client para gerar signed URL do bucket `documents` e fazer fetch do conteúdo binário
- Converter para base64 (ou Uint8Array) e usar o campo `attachments` do denomailer:
  ```
  attachments: [{ filename: "doc.pdf", content: binaryData, encoding: "binary" }]
  ```
- A biblioteca denomailer já suporta attachments nativamente

### 3. `src/components/ClientObligationsTab.tsx` e `src/pages/CalendarView.tsx` — sem mudanças estruturais
- O envio manual via `EmailComposeDialog` também deve passar os anexos; adicionar prop `attachments` ao dialog e passá-los na chamada ao `smtp-send`

### 4. `src/components/EmailComposeDialog.tsx` — suportar anexos
- Receber prop opcional `attachments: Array<{ fileUrl: string, fileName: string }>`
- Exibir lista dos arquivos que serão anexados (apenas visual, não editável)
- Incluir no body enviado à Edge Function

## Detalhes técnicos
- Os arquivos estão no bucket privado `documents` do Supabase Storage
- A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` para gerar signed URLs e baixar os arquivos
- O path no `file_url` segue o padrão do storage (`client_id/file.ext`)
- Limite prático: Gmail SMTP permite anexos até ~25MB total
- Nenhuma migração necessária

