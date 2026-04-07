
# Corrigir posicionamento de mensagens enviadas no chat

## Problema
Mensagens enviadas (tipo `whatsapp_outgoing` e `whatsapp`) estão aparecendo no lado esquerdo (brancas, como recebidas) em vez de no lado direito (verdes, como enviadas).

**Causa raiz**: O webhook salva TODAS as mensagens com `sender_id = systemUserId` (primeiro admin). Se o usuário logado não for esse admin específico, `isMine` é `false` e a mensagem aparece como recebida. Além disso, mensagens enviadas via `whatsapp-send` (automáticas) também usam o sender_id do token, que pode não coincidir.

## Solução

### `src/components/chat/MessageBubble.tsx`
Alterar a lógica de posicionamento para considerar o `message_type` como indicador definitivo de direção:

- Se `messageType` é `whatsapp_outgoing` ou `whatsapp` → tratar como mensagem enviada (lado direito, verde), independentemente do `sender_id`
- Se `messageType` é `whatsapp_incoming`, `whatsapp_image`, `whatsapp_video`, `whatsapp_audio`, `whatsapp_document` → tratar como mensagem recebida (lado esquerdo, branca)
- Para mensagens internas (`text`), manter a lógica atual baseada em `sender_id === currentUserId`

Lógica simplificada:
```typescript
const isOutgoing = messageType === 'whatsapp_outgoing' || messageType === 'whatsapp';
const isIncoming = messageType === 'whatsapp_incoming' || messageType === 'whatsapp_image' || ...;

// Para posicionamento:
const showAsRight = isOutgoing || (isMine && !isIncoming);
```

Isso resolve tanto mensagens enviadas pelo app quanto as enviadas pelo celular (capturadas pelo webhook como `fromMe`).

## Arquivo alterado
- `src/components/chat/MessageBubble.tsx` — ~3 linhas alteradas
