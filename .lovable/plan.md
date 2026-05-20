## Abrir anexos via blob URL (evitar ERR_BLOCKED_BY_CLIENT)

### Backend — `supabase/functions/gmail-attachment/index.ts`
- Aceitar `mode: 'bytes'` no body.
- Quando `mode === 'bytes'`: baixar do bucket `email-attachments` via `storage.download(path)` e retornar os bytes com `Content-Type` do anexo e `Content-Disposition: inline; filename="..."`.
- Fora desse modo, manter o comportamento atual (JSON com `signedUrl`).

### Frontend — `src/pages/Email.tsx` (`downloadAttachment`)
- Substituir `supabase.functions.invoke` + `window.open(signedUrl)` por:
  - `fetch` direto a `${VITE_SUPABASE_URL}/functions/v1/gmail-attachment` com `Authorization: Bearer <access_token>` (da sessão) e body `{ attachmentRowId, mode: 'bytes' }`.
  - Ler como `blob`, criar `URL.createObjectURL(blob)` e `window.open(blobUrl, '_blank')`.
  - `setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)`.
- Aba nova passa a usar `blob:https://vehub.lovable.app/...`, que adblockers não bloqueiam.

### Sem mudanças
- Sem migration, sem alterações no bucket ou em `email_attachments`.