## Objetivo

Exibir na notificação push: **Nome do contato**, **Empresa vinculada** e **prévia da mensagem**.

## Como ficará

- **Título**: `Nome do contato · Empresa` (ex.: `Rafael Murilo · Acme Ltda`)
  - Se não houver empresa vinculada: só o nome do contato
  - Se não houver nome: usa o telefone formatado
- **Corpo**: prévia da mensagem (até ~140 caracteres)
  - Para mídia sem texto: rótulos amigáveis — `📷 Imagem`, `🎙️ Áudio`, `🎬 Vídeo`, `📎 Documento`, `🖼️ Sticker`

## Mudanças

1. `supabase/functions/chat-notify/index.ts`
   - Buscar `client_id` da conversa e, quando existir, ler `company_name` e `contact_name` da tabela `clients`.
   - Montar o `title` combinando contato + empresa.
   - Montar o `body` usando `msg.content`; se vazio, derivar prévia a partir de `message_type` (mídia).
   - Manter `tag` por conversa e `url: /chat`.

2. Reimplantar `chat-notify`.

## Observação

Sem alteração de UI. Apenas a Edge Function que monta o payload da notificação.