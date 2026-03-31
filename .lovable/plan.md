

# Suporte a todos os tipos de mídia no WhatsApp (áudio, imagem, vídeo, documentos)

## Problema
Atualmente o webhook ignora mensagens sem texto (`no_text`). Áudios, imagens sem legenda, vídeos sem legenda e documentos sem legenda são descartados. O frontend só renderiza texto.

## Abordagem

### 1. Migração SQL — adicionar coluna `media_url` na tabela `chat_messages`
```sql
ALTER TABLE chat_messages ADD COLUMN media_url text;
```
Armazenará a URL do arquivo de mídia baixado do WhatsApp via EvolutionAPI.

### 2. `supabase/functions/whatsapp-webhook/index.ts`
- Detectar o tipo de mensagem: `audioMessage`, `imageMessage`, `videoMessage`, `documentMessage`, `stickerMessage`
- Para cada tipo, extrair o texto (caption) se houver, ou usar um placeholder descritivo (ex: "🎵 Áudio", "📷 Imagem", "📹 Vídeo", "📎 Documento")
- Baixar a mídia via EvolutionAPI endpoint `GET /chat/getBase64FromMediaMessage/{instance}` passando o `message` original
- Fazer upload do base64 para o bucket `documents` do Supabase Storage (pasta `chat-media/`)
- Gerar URL pública/assinada e salvar em `media_url`
- Salvar `message_type` mais específico: `whatsapp_audio`, `whatsapp_image`, `whatsapp_video`, `whatsapp_document`
- Remover o bloqueio `if (!text)` — agora processar mensagens mesmo sem texto

### 3. Storage — criar pasta e política para mídia do chat
- Usar o bucket `documents` existente com subpasta `chat-media/`
- Ou criar bucket dedicado `chat-media` (público para facilitar exibição)

### 4. `src/components/chat/MessageArea.tsx`
- Incluir `media_url` na interface `ChatMessage`

### 5. `src/pages/Chat.tsx`
- Incluir `media_url` na query de mensagens

### 6. `src/components/chat/MessageBubble.tsx`
- Adicionar prop `mediaUrl`
- Renderizar conforme o `messageType`:
  - **`whatsapp_image`**: `<img>` com a URL, clicável para abrir em nova aba
  - **`whatsapp_video`**: `<video>` com controles nativos
  - **`whatsapp_audio`**: `<audio>` com controles nativos (estilo compacto)
  - **`whatsapp_document`**: link para download com ícone de arquivo e nome
- Manter o texto/caption abaixo da mídia quando houver

### 7. `index.html` — CSP
- Adicionar o domínio do Supabase Storage ao `img-src` e `media-src` (já deve estar coberto por `https://*.supabase.co`)

## Detalhes técnicos

**EvolutionAPI — download de mídia:**
```
POST {EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instance}
Headers: { apikey: EVOLUTION_API_KEY }
Body: { message: { key: {...}, message: {...} } }
Response: { base64: "...", mimetype: "audio/ogg", fileName: "..." }
```

**Fluxo:**
```text
WhatsApp -> EvolutionAPI webhook -> whatsapp-webhook Edge Function
  -> detecta tipo (audio/image/video/doc)
  -> baixa base64 via EvolutionAPI
  -> upload para Supabase Storage
  -> insere chat_message com media_url + message_type específico
  -> frontend renderiza conforme tipo
```

## Arquivos modificados
- Migração SQL — coluna `media_url` + bucket (se necessário)
- `supabase/functions/whatsapp-webhook/index.ts` — processar todos os tipos de mídia
- `src/components/chat/MessageBubble.tsx` — renderizar mídia
- `src/components/chat/MessageArea.tsx` — interface atualizada
- `src/pages/Chat.tsx` — query atualizada
- `index.html` — CSP `media-src` se necessário

