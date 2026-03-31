

# Receber mensagens WhatsApp via webhook EvolutionAPI no Chat

## Resumo
Criar uma Edge Function pública que recebe webhooks da EvolutionAPI. Quando uma mensagem de texto chega, o sistema identifica o cliente pelo número de telefone, encontra/cria a conversa WhatsApp e insere a mensagem no chat com indicador visual de "recebida".

## Alterações

### 1. Nova Edge Function: `whatsapp-webhook`
- **Pública** (sem JWT) — a EvolutionAPI chama diretamente
- Recebe POST com payload da EvolutionAPI (evento `messages.upsert`)
- Extrai: número do remetente, texto da mensagem, timestamp
- Busca o cliente pelo `contact_phone` na tabela `clients`
- Encontra/cria `chat_conversation` vinculada ao `client_id`
- Insere `chat_message` com `channel: 'whatsapp'`, `message_type: 'whatsapp'`
- O `sender_id` será o `created_by` da conversa (o usuário interno responsável), já que o remetente é externo
- Suporte a verificação GET (health check) da EvolutionAPI

### 2. Migração SQL (opcional)
- Nenhuma alteração de schema necessária — as colunas `client_id`, `channel` e `message_type` já existem

### 3. Configuração
- Adicionar `[functions.whatsapp-webhook]` com `verify_jwt = false` no `supabase/config.toml`

### 4. UI — Identificar mensagens recebidas
- Atualizar `MessageBubble.tsx` para mostrar mensagens WhatsApp recebidas (de clientes) com estilo diferente: ícone WhatsApp + label "Cliente" como nome do remetente
- No `whatsapp-webhook`, o `sender_id` será um ID "sistema" ou o criador da conversa, e o `content` terá prefixo para distinguir

## Payload esperado da EvolutionAPI

```text
POST /whatsapp-webhook
{
  "event": "messages.upsert",
  "instance": "nome-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "..."
    },
    "message": {
      "conversation": "Texto da mensagem"
      // ou extendedTextMessage.text
    },
    "messageTimestamp": 1234567890
  }
}
```

## Fluxo

```text
Cliente responde WhatsApp
  → EvolutionAPI recebe
    → POST para whatsapp-webhook Edge Function
      → Identifica cliente por telefone
      → Encontra/cria conversa WhatsApp
      → Insere chat_message (channel='whatsapp', message_type='whatsapp')
        → Realtime atualiza Chat UI
```

## Arquivos modificados
- `supabase/functions/whatsapp-webhook/index.ts` — nova Edge Function
- `supabase/config.toml` — adicionar função com verify_jwt = false

