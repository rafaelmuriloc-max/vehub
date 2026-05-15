## Problema

Mensagens enviadas pela Gisele (agente de triagem) aparecem no chat interno assinadas com "Márcio".

**Causa:** o edge function `chat-triage-agent` chama `whatsapp-send-text` sem `senderId`. O fallback escolhe o primeiro admin (Márcio) e grava `chat_messages.sender_id = <id do Márcio>`. No frontend, `MessageArea` resolve `sender_name` via `profiles.full_name` a partir do `sender_id`, então mostra "Márcio". O cliente vê correto porque o WhatsApp recebe `*Gisele:*` no corpo.

## Solução

Persistir o nome do agente na própria mensagem e usá-lo no UI quando presente.

### Banco

1. Migration: `ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS agent_name text;`

### Edge function `whatsapp-send-text`

2. Aceitar campo opcional `agentName` no body.
3. Incluir `agent_name: agentName ?? null` no `insert` em `chat_messages`.

### Edge function `chat-triage-agent`

4. Nas duas chamadas a `whatsapp-send-text` (`/ask` e transferência) passar `agentName: agentName` (já tem a variável `agentName` resolvida via `company_settings.agent_name`).

### Frontend

5. `src/pages/Chat.tsx`: nas duas queries de mensagens (carga inicial linha ~237 e realtime ~300) selecionar também `agent_name` e usar:
   ```ts
   sender_name: m.agent_name || nameMap.get(m.sender_id) || 'Usuário'
   ```
6. `src/components/chat/MessageArea.tsx`: incluir `agent_name?: string` no tipo `Message` (somente para tipagem; a substituição é feita em Chat.tsx). Também propagar em `reply_to_snapshot` se necessário (não obrigatório nesta correção).

### Resultado

- Mensagens da Gisele exibem "Gisele" (ou o `agent_name` configurado) no balão verde do chat interno.
- Mensagens humanas continuam exibindo o nome do profile.
- WhatsApp do cliente continua igual.
