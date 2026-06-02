## Permitir transferir chamados fechados

Hoje o botão "Transferir" no cabeçalho do chat só aparece quando o chamado está aberto (`!isClosed`). Quando o chamado já foi fechado, não há como repassá-lo para outro atendente — só sobra "Reabrir Chamado".

### Mudanças

1. **`src/components/chat/MessageArea.tsx`** — remover a guarda `!isClosed` do botão de transferir, mantendo as outras (Solicitar tarefa, Fechar) inalteradas. O botão passa a aparecer também em chamados fechados.

2. **`src/pages/Chat.tsx` → `transferTicket`** — ao transferir, se o chamado estiver fechado, reabrir automaticamente na mesma operação:
   - `update({ assigned_to: targetUserId, status: 'open', closed_at: null, waiting_since: null, total_wait_seconds: 0 })` quando `activeConv.status === 'closed'`;
   - quando aberto, manter o comportamento atual (só `assigned_to`).
   - Toast passa a informar "Chamado reaberto e transferido para X" no caso fechado.

Nada mais muda: triagem, RLS e o resto da UI seguem iguais.