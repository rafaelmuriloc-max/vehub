

# Corrigir indicador de não lida ao abrir conversa

## Problema
Dois issues ao abrir uma conversa:

1. **Filtro incorreto para marcar como lida** (linha 190-192): Usa `m.sender_id !== user.id` para encontrar mensagens não lidas, mas mensagens WhatsApp incoming também têm `sender_id = user.id` (o webhook usa o mesmo systemUserId). Deve usar `message_type` como já feito no `unreadMap`.

2. **Badge não atualiza na lista**: Após marcar mensagens como lidas no banco, o estado local `conversations` não é recarregado, então o badge continua visível até o próximo evento realtime.

## Alterações em `src/pages/Chat.tsx`

### 1. Corrigir filtro de mensagens não lidas (linha ~190-192)
Trocar:
```typescript
const unreadIds = data
  .filter(m => m.sender_id !== user.id && !m.read_at)
  .map(m => m.id);
```
Por:
```typescript
const unreadIds = data
  .filter(m => m.message_type !== 'text' && m.message_type !== 'whatsapp_outgoing' && !m.read_at)
  .map(m => m.id);
```

### 2. Recarregar conversas após marcar como lidas (após linha ~198)
Após o `update`, chamar `loadConversations()` para atualizar os badges na lista de conversas. O hook `useUnreadCount` já se atualiza automaticamente via realtime ao detectar o UPDATE.

## Arquivo
- `src/pages/Chat.tsx` (~3 linhas alteradas)

