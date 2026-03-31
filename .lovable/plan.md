

# Exibir mensagens WhatsApp no Chat

## Resumo
Quando uma mensagem WhatsApp for enviada (via API oficial ou EvolutionAPI), ela será automaticamente inserida como mensagem no sistema de chat interno, em uma conversa dedicada ao cliente. As mensagens aparecerão com um indicador visual "WhatsApp".

## Alterações

### 1. Migração SQL
- Adicionar coluna `client_id uuid` na tabela `chat_conversations` para vincular conversas a clientes
- Adicionar coluna `channel text default 'internal'` na tabela `chat_messages` para distinguir mensagens internas de WhatsApp (`'whatsapp'`)
- Política RLS para permitir inserção via service role (edge function)

### 2. `supabase/functions/whatsapp-send/index.ts`
Após enviar a mensagem com sucesso pela Meta API, além de registrar em `whatsapp_logs`:
- Buscar ou criar uma `chat_conversation` vinculada ao `client_id` (nome = nome do cliente + " (WhatsApp)")
- Garantir que o usuário remetente é participante
- Inserir a mensagem em `chat_messages` com `message_type: 'whatsapp'` e o conteúdo enviado

### 3. `src/components/chat/MessageBubble.tsx`
- Exibir badge/ícone do WhatsApp quando `message_type === 'whatsapp'`
- Estilo levemente diferente (ícone verde do WhatsApp ao lado do horário)

### 4. `src/pages/Chat.tsx`
- Incluir `message_type` no select de mensagens
- Passar `messageType` para o `MessageBubble`

### 5. `src/components/chat/MessageArea.tsx`
- Propagar `message_type` no `ChatMessage` interface
- Passar para `MessageBubble`

## Fluxo
```text
Envio WhatsApp → Meta API → Sucesso
  ├─ Insere em whatsapp_logs (já existe)
  └─ Busca/cria chat_conversation para o cliente
     └─ Insere chat_message com message_type='whatsapp'
        └─ Realtime atualiza o Chat UI com badge WhatsApp
```

## Arquivos modificados
- Migração SQL (coluna `client_id` em conversations, `channel` em messages)
- `supabase/functions/whatsapp-send/index.ts`
- `src/components/chat/MessageBubble.tsx`
- `src/components/chat/MessageArea.tsx`
- `src/pages/Chat.tsx`

