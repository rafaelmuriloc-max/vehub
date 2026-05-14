## Problema

A contagem de não lidas (badge nas conversas e badge global do sidebar) inclui mensagens enviadas automaticamente pelo sistema (templates de obrigações, mídias enviadas pela função `whatsapp-send`/`whatsapp-send-media`). Essas mensagens são "saídas" e não deveriam contar como não lidas.

Hoje o filtro exclui apenas `message_type IN ('text','whatsapp_outgoing')`, mas mensagens automáticas usam `whatsapp`, `whatsapp_document`, `whatsapp_image`, etc. — então caem na contagem.

Mensagens recebidas reais sempre têm prefixo `whatsapp_incoming*` (ver `whatsapp-webhook`).

## Solução

Restringir o que conta como "não lida" a mensagens de entrada do WhatsApp.

### 1. Migration — `get_chat_inbox`

Trocar a CTE `uc` para contar apenas:

```sql
message_type LIKE 'whatsapp_incoming%'
AND read_at IS NULL
AND deleted_at IS NULL
AND NOT (p_user = ANY(deleted_for))
```

(remove o `NOT IN ('text','whatsapp_outgoing')` antigo).

### 2. `src/hooks/useUnreadCount.ts`

Mudar a query de mensagens para:

```ts
.like('message_type', 'whatsapp_incoming%')
.is('read_at', null)
```

(remover o `.not('message_type','in', ...)`).

### 3. `src/pages/Chat.tsx` (linha 259)

Mesmo critério no filtro local de marcação como lida:

```ts
.filter(m => m.message_type?.startsWith('whatsapp_incoming') && !m.read_at)
```

## Fora de escopo

- Notificações sonoras / push (já usam outro caminho).
- Mensagens internas (`text`) — continuam não contando, como hoje.
- Backfill: mensagens automáticas antigas que estão `read_at IS NULL` deixam de aparecer no contador automaticamente após a migration.
