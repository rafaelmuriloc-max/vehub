

# Corrigir exibição do nome do remetente nas mensagens

## Problema

O `senderName` aparece no topo de **todas** as mensagens enviadas pela equipe (outgoing), mas deveria aparecer apenas como **assinatura** nas mensagens enviadas pelo próprio usuário logado. Atualmente, a condição `!isIncoming && senderName` exibe o nome em todas as mensagens não-incoming.

## Solução

Passar uma nova prop `showSenderName` do `MessageArea` para o `MessageBubble`, controlando a exibição baseada em `msg.sender_id === currentUserId`.

### Alterações

#### `src/components/chat/MessageArea.tsx` (~1 linha)
- Na renderização do `MessageBubble`, passar `senderName` apenas quando `msg.sender_id === currentUserId`:

```tsx
senderName={msg.sender_id === currentUserId ? msg.sender_name : undefined}
```

Isso garante que apenas as mensagens enviadas pelo usuário logado exibam o nome como assinatura. Mensagens de outros membros da equipe e mensagens recebidas não mostrarão o nome.

## Arquivos
- `src/components/chat/MessageArea.tsx` (1 linha alterada)

