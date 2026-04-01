

# Corrigir exibição do nome do remetente no chat

## Problema
O nome do usuário logado aparece em **todas** as mensagens enviadas (linha 94 do `MessageBubble`), inclusive em conversas 1:1 com clientes WhatsApp. O correto é mostrar o nome apenas nas mensagens enviadas por usuários internos (para diferenciar quem da equipe respondeu), sem mostrar nas mensagens recebidas do cliente.

## Solução

### `src/components/chat/MessageBubble.tsx`

Alterar a lógica de exibição do `senderName` (linhas 94-99):

- **Remover** a condição `isMine && !isIncoming` (que mostra o nome apenas do usuário logado atual)
- **Substituir** por: mostrar `senderName` em **todas as mensagens que não são incoming do WhatsApp** (ou seja, mensagens enviadas por qualquer usuário interno da equipe), independentemente de ser `isMine` ou não
- Mensagens `whatsapp_incoming` (do cliente) não exibem nome — o nome já está no header da conversa

Lógica final:
```
// Mostra nome em mensagens outgoing (enviadas por usuários internos)
{!isIncoming && senderName && (isMine || isWhatsApp) && (
  <p className="...">{senderName}</p>
)}
```

Isso garante que:
- Mensagens enviadas por mim: mostra meu nome
- Mensagens enviadas por outro colega (outgoing via webhook `fromMe`): mostra o nome dele
- Mensagens recebidas do cliente (incoming): não mostra nome

## Arquivo
- `src/components/chat/MessageBubble.tsx`

