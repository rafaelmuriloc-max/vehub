## Problema
Hoje, mensagens dos tipos `whatsapp_image | whatsapp_video | whatsapp_audio | whatsapp_document` são marcadas como `isIncoming = true` em `MessageBubble.tsx` e `MessageArea.tsx`. Isso faz toda mídia que **eu envio** aparecer à esquerda e com fundo branco, em vez de ficar à direita com fundo verde igual ao texto.

## Correção

A posição/cor deve depender exclusivamente de quem é o remetente, e não do tipo de mídia. O único tipo que indica de fato "recebida" é `whatsapp_incoming` (criado pelo webhook).

### `src/components/chat/MessageBubble.tsx`
- Remover `whatsapp_image | video | audio | document` da definição de `isIncoming`. Manter apenas `whatsapp_incoming`.
- `showOnRight = isOutgoing || (isMine && !isIncoming)` (já está correto — passa a funcionar com o ajuste acima).
- Repassar `tint='green'` para `<AudioMessage>` quando `showOnRight` for true (já está assim).

### `src/components/chat/MessageArea.tsx`
- Mesma correção na linha 151: `isIncoming` só inclui `whatsapp_incoming`.

## Resultado
- Mídia que eu enviei → bolha verde, alinhada à direita, com mesma assinatura/horário das mensagens de texto.
- Mídia recebida (vinda do webhook como `whatsapp_incoming` ou marcada por `sender_id` ≠ usuário) → bolha branca à esquerda, como hoje.
- Sem mudanças em backend, banco ou layout dos componentes de áudio/documento.
