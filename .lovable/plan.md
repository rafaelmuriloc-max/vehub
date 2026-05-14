Marcar todas as mensagens de chat como lidas, zerando os contadores de não lidas em todas as conversas.

## O que será feito

Executar um UPDATE no banco que define `read_at = now()` em todas as linhas de `public.chat_messages` onde `read_at IS NULL`. Isso fará com que `get_chat_inbox` retorne `unread_count = 0` para todas as conversas e o hook `useUnreadCount` também retorne 0.

## Detalhes técnicos

```sql
UPDATE public.chat_messages
SET read_at = now()
WHERE read_at IS NULL;
```

Operação única, sem alterações de código ou schema. Novas mensagens recebidas a partir de agora voltam a contar normalmente.