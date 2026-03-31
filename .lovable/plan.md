

# Mostrar nome do contato no chat WhatsApp

## Problema
Atualmente, quando um cliente não é encontrado no banco, a conversa é criada com o nome `WhatsApp {número}`. Mesmo quando o cliente é encontrado, usa `company_name` (razão social), não o `contact_name` (nome do contato). Além disso, na bolha de mensagem recebida aparece apenas "📱 Cliente" genérico.

## Alterações

### 1. `supabase/functions/whatsapp-webhook/index.ts`
- Ao encontrar o cliente, usar `contact_name` como prioridade para o nome da conversa, caindo para `company_name` se não houver
- Extrair `pushName` do payload da EvolutionAPI (`data.pushName`) como fallback para quando o cliente não é encontrado — em vez de mostrar apenas o número
- Formato da conversa: `{contact_name || company_name} (WhatsApp)` ou `{pushName} (WhatsApp)` ou `WhatsApp {número}`

### 2. `supabase/functions/whatsapp-send/index.ts`
- Ao criar conversa, buscar `contact_name` além de `company_name` e usar como prioridade no nome

### 3. `src/components/chat/MessageBubble.tsx`
- Na linha de "📱 Cliente", exibir o `senderName` se disponível: `📱 {senderName}` em vez de `📱 Cliente`

### 4. `src/pages/Chat.tsx`
- Nenhuma alteração necessária — o nome da conversa já é exibido no header pelo `conversationName`

## Arquivos modificados
- `supabase/functions/whatsapp-webhook/index.ts` — usar `contact_name` e `pushName`
- `supabase/functions/whatsapp-send/index.ts` — usar `contact_name` na criação da conversa
- `src/components/chat/MessageBubble.tsx` — exibir nome do contato na bolha

