## Adicionar contador de conversas em Espera

Mostrar um badge ao lado da aba "Espera" com o número de conversas WhatsApp aguardando atendimento (status `open` e sem atendente).

### Mudanças

**1. `src/pages/Chat.tsx`**
- Novo estado `waitingCount: number`.
- Função `loadWaitingCount()` que executa:
  ```ts
  supabase.from('chat_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .is('assigned_to', null)
    .not('whatsapp_phone', 'is', null);
  ```
- Chamar `loadWaitingCount()` junto com `loadConversations()` (no useEffect inicial e após eventos do realtime que já disparam reload).
- Passar `waitingCount` como prop para `<ConversationList />`.

**2. `src/components/chat/ConversationList.tsx`**
- Adicionar `waitingCount?: number` em `ConversationListProps`.
- Na `TabsTrigger value="in_progress"`, renderizar um badge no mesmo padrão visual já usado em "Chat" (bg-destructive, arredondado, `99+` quando excede), exibido apenas quando `waitingCount > 0`.

### Observações
- Sem mudanças de schema/migrations.
- O contador reflete todas as conversas em espera, mesmo quando o usuário está em outra aba.
- RLS: admins já enxergam essas conversas (são participantes via webhook).
