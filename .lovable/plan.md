

# Chat: receber mensagens de outros dispositivos e enviar mensagens WhatsApp

## Problemas atuais

1. **Mensagens enviadas por outros dispositivos não aparecem**: O webhook (`whatsapp-webhook`) ignora mensagens `fromMe` (linha 44). Mensagens enviadas pelo celular ou WhatsApp Web nunca chegam ao chat.

2. **Envio de mensagens**: O `sendMessage` atual apenas insere no banco local — não envia via WhatsApp. Precisa chamar a API correta dependendo do contexto (Evolution para iniciar conversa, Meta API oficial após o cliente responder).

## Alterações

### 1. Webhook: aceitar mensagens `fromMe` (`supabase/functions/whatsapp-webhook/index.ts`)
- Remover o skip de `fromMe` (linhas 44-49)
- Quando `fromMe === true`:
  - Usar `channel: "whatsapp"` e `message_type: "whatsapp_outgoing"`
  - O `sender_id` continua sendo o admin (sistema) mas marcar como `fromMe` para distinguir
  - Não inserir duplicata: verificar se já existe uma mensagem com o mesmo `content` + `conversation_id` nos últimos 10 segundos (para evitar duplicar mensagens enviadas pelo próprio chat)

### 2. Nova edge function: `whatsapp-send-text` (`supabase/functions/whatsapp-send-text/index.ts`)
- Recebe `{ conversationId, text }`
- Busca a conversa para obter `whatsapp_phone`
- Verifica se existe mensagem recebida do cliente nas últimas 24h (`channel = 'whatsapp'` e `message_type` contendo `whatsapp_incoming`)
  - **Se SIM (janela 24h aberta)**: envia via Meta API oficial (texto livre)
  - **Se NÃO (fora da janela)**: envia via Evolution API (`sendText`)
- Insere a mensagem no `chat_messages` com `channel: 'whatsapp'`
- Atualiza `updated_at` da conversa

### 3. Frontend: enviar via WhatsApp em conversas WhatsApp (`src/pages/Chat.tsx`)
- No `sendMessage`, verificar se a conversa ativa tem `whatsapp_phone`
  - Se sim: chamar `supabase.functions.invoke('whatsapp-send-text', ...)` em vez de inserir direto
  - Se não: manter o comportamento atual (mensagem interna)
- Adicionar `whatsappPhone` ao tipo `ConversationItem` e passá-lo do `loadConversations`

### 4. ConversationList: expor `whatsappPhone` (`src/components/chat/ConversationList.tsx`)
- Adicionar `whatsappPhone?: string` ao tipo `ConversationItem`

### 5. Config TOML
- Adicionar `[functions.whatsapp-send-text]` com `verify_jwt = false`

## Lógica de deduplicação (webhook fromMe)
```text
Mensagem enviada pelo chat:
  1. Frontend chama whatsapp-send-text
  2. Edge function envia + insere no chat_messages
  3. Webhook recebe fromMe → verifica se existe msg igual nos últimos 10s → SKIP

Mensagem enviada por outro dispositivo:
  1. Webhook recebe fromMe → não encontra duplicata → INSERE
```

## Arquivos
- `supabase/functions/whatsapp-webhook/index.ts` — aceitar fromMe com deduplicação
- `supabase/functions/whatsapp-send-text/index.ts` — nova function (Evolution ou Meta)
- `supabase/config.toml` — registrar nova function
- `src/pages/Chat.tsx` — roteamento de envio
- `src/components/chat/ConversationList.tsx` — expor whatsappPhone

