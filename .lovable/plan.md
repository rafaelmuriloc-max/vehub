## Renomear aba "Em andamento" para "Espera"

A aba do meio do chat passará a se chamar **Espera** e listará apenas conversas:
- com chamado em aberto (`status = 'open'`)
- **sem atendente atribuído** (`assigned_to IS NULL`)

Assim que alguém for atribuído à conversa, ela some da aba Espera (e aparece em "Minhas" para o atendente).

### Mudanças

1. **Migration** — atualizar `public.get_chat_inbox(p_user, p_tab)`:
   - Branch `'in_progress'` passa a filtrar `c.status = 'open' AND c.assigned_to IS NULL` (em vez de `assigned_to IS DISTINCT FROM p_user`).
   - Mantém os branches `'mine'` e `'all'` como estão.

2. **`src/components/chat/ConversationList.tsx`** (linha ~115-118):
   - Trocar o label visível da `TabsTrigger value="in_progress"` de "Em andamento" para **"Espera"** (manter ícone se houver).

Sem mudanças em business logic, apenas no filtro do RPC e no rótulo da aba. O valor interno `'in_progress'` continua para evitar refator desnecessário.