## Triagens aguardando primeiro atendimento

Quando uma conversa é atribuída (pela Gisele OU manualmente por um admin), ela permanece na aba **Espera** com a tag colorida do atendente designado. Assim que o atendente envia a 1ª resposta, ela migra automaticamente para a aba **Chat** dele.

### 1. Banco

Migration:
- `chat_conversations.awaiting_first_reply boolean NOT NULL DEFAULT false`.
- Trigger `BEFORE UPDATE` em `chat_conversations`: quando `assigned_to` muda de NULL → não-NULL, setar `awaiting_first_reply = true`. (Cobre Gisele e atribuição manual sem precisar mexer em cada call site.)
- Trigger `AFTER INSERT` em `chat_messages`: se mensagem é saída (`message_type IN ('text','whatsapp_outgoing')`), `sender_id` = `chat_conversations.assigned_to` e `awaiting_first_reply = true` → setar `awaiting_first_reply = false`.
- Atualizar a função `get_chat_inbox`:
  - `mine`: `assigned_to = p_user AND status='open' AND awaiting_first_reply = false`
  - `in_progress` (Espera): `status='open' AND (assigned_to IS NULL OR awaiting_first_reply = true)`
  - Adicionar `awaiting_first_reply` ao retorno.

### 2. Edge Function `chat-triage-agent`

Nenhuma mudança lógica necessária — o trigger cuida do flag quando `assigned_to` é gravado. Só validar que o update de transferência continua atômico.

### 3. UI — `ConversationList.tsx`

- Estender o tipo de conversa com `awaitingFirstReply` e ler do RPC.
- Na aba **Espera**, quando `assigned_to_name` existe, exibir badge com `assigned_to_color` + nome do atendente (formato: "Aguardando {Nome}"), substituindo/complementando o indicador atual de tempo de espera.
- Conversas sem `assigned_to` continuam mostrando "Aguardando atendimento" como hoje.

### 4. Contadores

- `mineCount` em `Chat.tsx` já vem do RPC `mine`, então será automaticamente menor (exclui as awaiting). OK.
- Badge da aba Espera passa a incluir as awaiting.

### Detalhes técnicos

- Trigger evita mexer em todos os pontos de UI/edge que atribuem. Atribuição via UPDATE direto é o caminho atual em todo lugar.
- Reabertura de chamado: se um admin reatribuir a outro atendente (NULL → user OU user → user2), o trigger marca novamente como awaiting. Comportamento desejado.
- Realtime: `chat_conversations` já tem realtime; o flip de `awaiting_first_reply` dispara update e a UI move o card entre abas naturalmente.

### Fora de escopo

- Notificação push extra para o atendente quando recebe uma triagem (pode ser próximo passo).
- Timeout automático para reatribuir se o atendente não responder em X minutos.
