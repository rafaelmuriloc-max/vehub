## Causa raiz

Toda mensagem WhatsApp enviada pelo chat é gravada em `chat_messages` com `sender_id = primeiro admin` (Márcio), independente de quem clicou em enviar. Por isso, no chat do app todas as conversas exibem "Márcio Macelan" na assinatura — enquanto no WhatsApp do destinatário o texto vai correto, pois o frontend prefixa `*Nome:*` no corpo da mensagem antes de mandar para a Meta/Evolution.

- `supabase/functions/whatsapp-send-text/index.ts` (linhas 154–174): ignora o usuário e força `senderId = adminRoles[0].user_id`.
- `supabase/functions/whatsapp-send-media/index.ts` já aceita `senderId` do frontend, mas o `whatsapp-send-text` não recebe nem usa.

## Correção

1. **Frontend (`src/pages/Chat.tsx`, linha 331)**: incluir `senderId: user.id` no body da invocação de `whatsapp-send-text` (igual já é feito para `whatsapp-send-media`).

2. **Edge Function `whatsapp-send-text`**:
   - Ler `senderId` do body junto com `conversationId`, `text`, `senderName`.
   - Usar esse `senderId` na inserção em `chat_messages`. Manter fallback para o primeiro admin caso não venha (compatibilidade).

Sem mudanças no webhook (mensagens recebidas continuam com sender = admin sistema, mas aparecem à esquerda como `whatsapp_incoming` e não exibem assinatura). Sem mudanças no banco.

## Validação

Após o deploy: enviar uma mensagem WhatsApp logado como outro usuário e confirmar que a assinatura no chat aparece com o nome correto, e que mensagens antigas continuam exibindo Márcio (são histórico, não retroativas).