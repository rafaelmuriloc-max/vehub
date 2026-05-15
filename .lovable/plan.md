## Não fechar chamados sem 1ª resposta do atendente

Hoje o `chat-inactivity-monitor` envia aviso após 30 min sem mensagem e fecha após mais 5 min, mesmo em chamados que ainda não tiveram a primeira resposta do atendente atribuído. Isso causa fechamentos indevidos de chamados recém-transferidos.

### Mudança

Em `supabase/functions/chat-inactivity-monitor/index.ts`, adicionar filtro `.eq('awaiting_first_reply', false)` na query principal que busca conversas candidatas a aviso/fechamento.

Efeito:
- Conversas com `awaiting_first_reply = true` (atribuídas mas sem resposta do atendente) ficam imunes ao timer de 30 + 5 min.
- Assim que o atendente envia a 1ª mensagem, o trigger `trg_chat_msg_clear_awaiting` zera o flag e o ciclo normal de inatividade volta a valer.
- Conversas sem `assigned_to` continuam fora do escopo do monitor (já são ignoradas).

### Memória

Atualizar `mem://features/chat/inactivity-auto-close` registrando a exceção: o timer só roda depois da 1ª resposta do atendente.

### Fora de escopo

- `chat-waiting-alert` (aviso de espera longa) permanece inalterado.
- Nenhuma mudança em UI, triggers ou RPC.
