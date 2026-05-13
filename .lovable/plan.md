## Diagnóstico

A coluna `waiting_since` da única conversa em espera está `NULL`, então o badge não aparece (ele só renderiza quando `waitingSince` existe). O trigger só preenche em novas mensagens de cliente; o backfill anterior não cobriu a linha atual.

## Correção

1. **Backfill imediato** — rodar `UPDATE chat_conversations SET waiting_since = COALESCE(waiting_since, updated_at) WHERE status='open' AND assigned_to IS NULL`.

2. **Fallback no frontend** — em `ConversationList.tsx`, na aba "Espera" exibir o cronômetro mesmo quando `waitingSince` for null, usando `lastMessageAt` como base. Assim qualquer conversa em espera sempre mostra um timer aproximado, mesmo se o trigger não tiver disparado por algum motivo.

## Detalhes técnicos

- Migration de dados (UPDATE) em `chat_conversations`.
- Mudança de UI: `<WaitingBadge since={conv.waitingSince || conv.lastMessageAt} />` quando `activeTab === 'in_progress'` e a conversa não tem responsável.
