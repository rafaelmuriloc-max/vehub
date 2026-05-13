## Funcionários veem todas as conversas (igual admin)

Hoje a RLS de `chat_conversations` libera SELECT só para: admin, conversas com `status='open'`, ou participante. Conversas **fechadas** ficam ocultas para funcionários, e mensagens/participantes seguem regras restritas. Vamos abrir a leitura para qualquer usuário autenticado.

### Migração de RLS

**`chat_conversations`**
- Remover policies de SELECT existentes ("Admins can view all conversations", "Authenticated users can view all open conversations", "Users can view conversations they participate in").
- Criar uma única policy: `authenticated` pode `SELECT` (`USING true`).
- Manter as policies de INSERT/UPDATE como estão (admin/participante).

**`chat_messages`**
- Substituir o SELECT atual (somente participantes) por: `authenticated` pode `SELECT` (`USING true`).
- Substituir o INSERT atual (precisa ser participante) por: `sender_id = auth.uid()` — qualquer autenticado pode mandar mensagem na conversa que está vendo.
- Manter UPDATE para participantes.

**`chat_participants`**
- Substituir o SELECT atual (`user_id = auth.uid()`) por: `authenticated` pode `SELECT` (`USING true`) — necessário para o app montar nomes/avatares dos participantes em conversas que o usuário não criou.
- Manter INSERT como está.

### Observações
- Nenhuma alteração de código frontend é necessária — assim que a RLS abrir, as 149 conversas WhatsApp em aberto + as 28 fechadas passam a aparecer para todos os funcionários nas abas "Aguardando" e "Todas".
- A aba padrão "Minhas" continua vazia para usuários sem conversas atribuídas — isso é o comportamento esperado dessa aba.
- Trade-off de privacidade: qualquer funcionário poderá ler qualquer mensagem de qualquer conversa (interna ou WhatsApp). Foi o que você pediu ao escolher "igual admin".

### Memória
- Atualizar `mem://features/chat/whatsapp-visibility` para refletir que a visibilidade universal vale para **todos os usuários autenticados**, não só admins.
