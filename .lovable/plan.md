

# Mostrar nome do contato na lista e cabeçalho + assinar mensagens enviadas

## Problema
1. A lista de conversas e o cabeçalho mostram "WhatsApp 554791004860" em vez do nome do contato
2. Mensagens enviadas pelo usuário logado não mostram o nome do remetente

## Alterações

### 1. `supabase/functions/whatsapp-webhook/index.ts`
O webhook já busca `contact_name` e `company_name` do cliente, mas o nome não está sendo persistido corretamente quando o cliente não é encontrado. Verificar e corrigir a lógica de nomeação — quando o cliente é encontrado, a conversa deve ser nomeada com `contact_name` (prioridade) ou `company_name`, e **atualizar o nome de conversas existentes** que ainda têm o formato antigo "WhatsApp {número}".

Adicionar lógica: ao encontrar um cliente por telefone, se a conversa já existe mas tem nome no formato "WhatsApp {número}", atualizar o nome para `{contact_name} (WhatsApp)`.

### 2. `src/components/chat/MessageBubble.tsx`
- Para mensagens **enviadas** (`isMine && !isIncoming`): mostrar o `senderName` acima do conteúdo em negrito, similar ao estilo de grupo
- Layout: nome do remetente em texto pequeno e bold acima da mensagem

```tsx
{isMine && !isIncoming && senderName && (
  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">{senderName}</p>
)}
```

### 3. `src/pages/Chat.tsx`
- Na `loadConversations`, para conversas WhatsApp (nome contém "WhatsApp" e número), buscar o `client_id` da conversa e consultar o `contact_name` do cliente para exibir o nome correto na lista
- Alternativa mais simples: a conversa já armazena o `client_id` — buscar o nome do cliente quando a conversa tem `client_id` e o nome atual é genérico

Abordagem: ao carregar conversas, se `conv.client_id` existe, buscar o `contact_name` do cliente e usá-lo como nome na lista.

### 4. `src/components/chat/MessageArea.tsx`
Nenhuma alteração necessária — o header já usa `conversationName` que virá corrigido do Chat.tsx.

## Arquivos modificados
- `supabase/functions/whatsapp-webhook/index.ts` — atualizar nome de conversas existentes
- `src/components/chat/MessageBubble.tsx` — mostrar nome do remetente em mensagens enviadas
- `src/pages/Chat.tsx` — resolver nome do contato via `client_id` da conversa

