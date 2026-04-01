

# Corrigir indicadores de mensagens não lidas

## Problema
O webhook do WhatsApp salva **todas** as mensagens (incoming e outgoing) com `sender_id = systemUserId` (o admin logado). O hook `useUnreadCount` filtra `.neq('sender_id', user.id)`, o que exclui 100% das mensagens — resultado: badge sempre zero.

Dados confirmados no banco: 309 mensagens não lidas, todas com `sender_id = a9a263c4...` (o admin), então o filtro `neq` remove todas.

## Solução
Usar `message_type` para identificar mensagens recebidas em vez de `sender_id`. Mensagens recebidas têm `message_type` começando com `whatsapp_incoming` ou `whatsapp_image`, `whatsapp_audio`, etc. Mensagens enviadas têm `whatsapp_outgoing` ou `text`.

### 1. `src/hooks/useUnreadCount.ts`
Trocar o filtro `.neq('sender_id', user.id)` por `.not('message_type', 'in', '("text","whatsapp_outgoing")')` — ou seja, contar apenas mensagens que NÃO são do tipo outgoing/text (que são as enviadas pela equipe).

### 2. `src/pages/Chat.tsx` — cálculo de `unreadMap`
Na linha ~89, trocar a condição `msg.sender_id !== user.id` pela mesma lógica baseada em `message_type`. A query de mensagens já retorna esse campo, basta usá-lo no filtro.

### 3. `src/pages/Chat.tsx` — query de mensagens
Garantir que a query que carrega mensagens para o `unreadMap` inclua o campo `message_type` no select.

## Arquivos
- `src/hooks/useUnreadCount.ts` (~1 linha)
- `src/pages/Chat.tsx` (~2 linhas)

