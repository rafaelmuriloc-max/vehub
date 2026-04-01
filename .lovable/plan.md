

# Indicadores visuais de mensagens não lidas no chat e sidebar

## O que será feito
Adicionar badges de contagem de mensagens não lidas em três locais:
1. **Conversa individual** — já existe (badge verde com número)
2. **Aba "Chat"** no ConversationList — badge com total de não lidas das conversas abertas do usuário
3. **Menu "Chat" na sidebar** — badge com total global de não lidas

## Alterações

### 1. Novo hook `src/hooks/useUnreadCount.ts`
- Query Supabase para contar mensagens não lidas (`read_at IS NULL` e `sender_id != user.id`) em conversas atribuídas ao usuário
- Subscription realtime na tabela `chat_messages` para atualizar automaticamente
- Exporta `totalUnread: number`

### 2. `src/components/chat/ConversationList.tsx`
- Receber `totalUnread` como prop (calculado a partir das conversations já carregadas)
- Exibir badge numérico na aba "Chat" quando `totalUnread > 0`

### 3. `src/pages/Chat.tsx`
- Calcular `totalUnread` somando `unreadCount` de todas as conversas da aba "mine"
- Passar para `ConversationList`

### 4. `src/components/AppSidebar.tsx`
- Usar o hook `useUnreadCount` para obter contagem global
- Exibir badge ao lado do item "Chat" no menu quando houver mensagens não lidas

## Detalhes técnicos

### Hook `useUnreadCount`
```typescript
// Consulta: chat_messages where sender_id != user.id AND read_at IS NULL
// JOIN com chat_conversations where assigned_to = user.id AND status = 'open'
// Realtime: re-fetch ao receber INSERT/UPDATE em chat_messages
```

### Badge na aba (ConversationList)
Badge pequeno ao lado do texto "Chat" na TabsTrigger, estilo similar ao WhatsApp (círculo com número).

### Badge na sidebar (AppSidebar)
Círculo pequeno com número posicionado ao lado direito do item "Chat".

## Arquivos
- `src/hooks/useUnreadCount.ts` (novo)
- `src/components/chat/ConversationList.tsx`
- `src/pages/Chat.tsx`
- `src/components/AppSidebar.tsx`

