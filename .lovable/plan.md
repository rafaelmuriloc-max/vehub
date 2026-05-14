## Objetivo

Permitir responder uma mensagem específica no chat (igual WhatsApp), com:
- Mini‑prévia da mensagem citada acima do campo de digitação (com X para cancelar).
- Balão de resposta mostrando a citação (barra colorida + autor + trecho/thumbnail) em cima do conteúdo, clicável para rolar até a original.
- Encaminhamento do contexto para o WhatsApp do cliente (Meta API `context.message_id`) — quando o cliente responder uma das nossas mensagens no WhatsApp, a citação também aparece no nosso chat.

## 1. Banco — `chat_messages`

Adicionar colunas (sem FK rígida, para sobreviver a apagamentos):

- `reply_to_id uuid` — id da mensagem original (mesma conversa).
- `reply_to_snapshot jsonb` — snapshot leve `{ sender_id, sender_name, content, message_type, media_url }` para renderizar a citação mesmo se a original for apagada.

Índice: `create index on chat_messages (reply_to_id)`.

Sem mudanças em RLS (herdam as policies atuais da tabela).

## 2. Edge functions

### `whatsapp-send-text` e `whatsapp-send-media`

- Aceitar campo opcional `reply_to_message_id` (uuid local) no body.
- Buscar `wa_message_id` da mensagem original; se existir, incluir no payload Meta:
  ```json
  { "context": { "message_id": "<wamid>" }, ... }
  ```
- Ao inserir a row em `chat_messages`, preencher `reply_to_id` e `reply_to_snapshot` (consultando a original).

### `whatsapp-webhook`

- Ler `value.messages[].context.id` (Meta) — quando presente, localizar a mensagem local cujo `wa_message_id = context.id` e salvar `reply_to_id` + snapshot na nova row de entrada.

## 3. Frontend

### `MessageArea.tsx`
- Estado `replyingTo: ChatMessage | null`.
- Passar `onReply={(msg)=>setReplyingTo(msg)}` para cada `MessageBubble`.
- Passar `replyingTo` + `onCancelReply` para `ChatInput`.
- `onSend` / `onSendMedia` propagam `replyingTo?.id`; limpar após enviar.
- Util `scrollToMessage(id)` (ref map) para clique na citação.

### `MessageBubble.tsx`
- Nova prop `onReply`, `replySnapshot`, `onJumpToReply`.
- Botão "Responder" no `DropdownMenu` (sempre visível, exceto em mensagem apagada).
- Renderiza acima do conteúdo, quando `replySnapshot` existir, um bloco com:
  - Barra vertical colorida (verde se autor = nós, cinza se contato).
  - Nome do autor + trecho (`content` truncado; "Foto/Vídeo/Áudio/Documento/Localização" para mídia).
  - Thumbnail à direita se `message_type` for imagem/vídeo.
  - `onClick` → `onJumpToReply(reply_to_id)`.

### `ChatInput.tsx`
- Novas props `replyingTo`, `onCancelReply`.
- Quando setado, renderizar barra acima do textarea (mesmo estilo do balão de citação) com botão X.
- `handleSend` envia o reply id para `onSend`/`onSendMedia` (mudar assinaturas para aceitar opcional `replyToId`).

### `Chat.tsx`
- Passar `replyToId` para as chamadas das edge functions e para o insert de mensagens internas (`text`).
- Subscrição realtime já cobre as novas colunas.

## 4. Fora de escopo

- Encaminhar (forward), reagir com emoji, marcar como favorita.
- Suporte a `context` da Evolution API (manteremos só Meta, que é o canal oficial do projeto).
- Animação de "swipe para responder" em mobile — só botão no menu por enquanto.

## Detalhes técnicos

```text
chat_messages
├── reply_to_id        uuid    null
└── reply_to_snapshot  jsonb   null
                         { sender_id, sender_name, content,
                           message_type, media_url }
```

Fluxo de envio com resposta:
```
ChatInput.handleSend
  → MessageArea.onSend(text, replyToId)
    → Chat.sendMessage(text, replyToId)
      → invoke('whatsapp-send-text', { ..., reply_to_message_id })
        → Meta API payload { context: { message_id: wamid } }
        → insert chat_messages { reply_to_id, reply_to_snapshot }
```
