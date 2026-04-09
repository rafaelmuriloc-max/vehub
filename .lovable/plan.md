

# Corrigir nome do chat e assinatura de mensagens

## Problemas identificados

1. **Nome no chat**: Na linha 123-125 de `Chat.tsx`, quando a conversa tem `client_id`, o nome exibido é `client.contact_name || client.company_name`, sobrescrevendo o nome que veio do WhatsApp (`conv.name`). Para conversas WhatsApp, o nome deve ser o do `conv.name` (pushName do WhatsApp).

2. **Assinatura em mensagens enviadas pelo chat**: Já funciona — `senderName` é passado nas edge functions. OK.

3. **Assinatura em mensagens automáticas (obrigações)**: A edge function `whatsapp-send` (usada pelas automações) também passa `senderName` em alguns casos. Precisa garantir que automações NÃO enviem `senderName`.

4. **Mensagens recebidas não devem ter assinatura**: No `MessageArea.tsx` linha 156, o `senderName` só é passado quando `msg.sender_id === currentUserId`. Mensagens recebidas (incoming) já não mostram assinatura no bubble. OK — mas o texto da mensagem recebida pode conter a assinatura `*Nome:*` embutida no conteúdo (vinda do WhatsApp). Isso é conteúdo externo e não controlamos.

## Alterações

### 1. `src/pages/Chat.tsx` — Priorizar nome WhatsApp
Na resolução de nome (linhas 120-131), para conversas com `whatsapp_phone`, usar `conv.name` (pushName do WhatsApp) ao invés de sobrescrever com nome da empresa/contato do cliente.

```typescript
// Para conversas WhatsApp, usar o nome da conversa (pushName)
if (conv.whatsapp_phone && conv.name) {
  name = conv.name; // nome do WhatsApp
} else if (conv.client_id && clientMap.has(conv.client_id)) {
  const client = clientMap.get(conv.client_id)!;
  name = client.contact_name || client.company_name || name;
} else if (!conv.is_group && !conv.client_id) { ... }
```

### 2. `src/lib/sendActivityWhatsApp.ts` — Remover assinatura das automações
Verificar se essa função passa `senderName` ao chamar `whatsapp-send` ou `whatsapp-send-text`, e remover para que automações não assinem.

### 3. Edge functions — Sem mudanças necessárias
A lógica `senderName ? ... : ...` já funciona: se não enviar `senderName`, não assina. Basta garantir que o frontend/automações passem (ou não) corretamente.

## Arquivos
- `src/pages/Chat.tsx` — ~5 linhas (priorizar `conv.name` para WhatsApp)
- `src/lib/sendActivityWhatsApp.ts` — verificar/remover `senderName` se presente

