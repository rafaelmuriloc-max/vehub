## Transferidos vão direto para o Chat do atendente; timer continua visível

Hoje, ao atribuir (Gisele ou manual), a conversa cai na aba **Espera** até a 1ª resposta. O usuário quer que ela vá direto para o **Chat** do atendente, mas o cronômetro de espera continue visível enquanto a 1ª resposta não acontecer — inclusive na aba **Geral**.

### 1. RPC `get_chat_inbox` (migração)

Reverter os filtros para o comportamento original, mantendo a coluna `awaiting_first_reply` no retorno:

- `mine`: `assigned_to = p_user AND status = 'open'` (sem condição de awaiting)
- `in_progress` (Espera): `status = 'open' AND assigned_to IS NULL` (apenas não atribuídas)
- `all` (Geral): inalterado.

Coluna, triggers (`trg_chat_conv_set_awaiting`, `trg_chat_msg_clear_awaiting`) e índice permanecem — continuam alimentando o flag `awaiting_first_reply` e a exceção do `chat-inactivity-monitor` (chamados sem 1ª resposta seguem imunes ao auto-close).

### 2. `src/pages/Chat.tsx`

Mapear `awaiting_first_reply` → `awaitingFirstReply` no objeto de conversa retornado pelo RPC.

### 3. `src/components/chat/ConversationList.tsx`

Substituir o gating do `WaitingBadge`:

- Antes: aparece só quando `activeTab === 'in_progress'`.
- Depois: aparece sempre que `conv.awaitingFirstReply === true` (independente da aba). Assim o cronômetro fica visível em **Chat**, **Espera** (caso ainda haja não-atribuídos com `waiting_since`) e **Geral**, e some assim que o atendente envia a 1ª mensagem (trigger zera o flag).

Para conversas não atribuídas (sem `awaitingFirstReply`), continua mostrando o badge na aba Espera quando há `waiting_since`, preservando o comportamento atual.

### 4. Memória

Atualizar `mem://features/chat/awaiting-first-reply`: conversas atribuídas (por Gisele ou manualmente) vão direto para o Chat do atendente; o `WaitingBadge` continua visível em qualquer aba até a 1ª resposta. A aba Espera volta a listar apenas chamados sem atendente.

### Fora de escopo

- `chat-inactivity-monitor` (já trata `awaiting_first_reply=true` corretamente).
- Lógica de atribuição em `ensureAssignedToMe` e fluxo da Gisele.
