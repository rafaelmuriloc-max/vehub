

# Fix: mostrar assinatura do usuário logado e remover badge "WhatsApp" nas mensagens enviadas

## Problemas atuais (conforme screenshot)
1. Mensagens enviadas (direita) mostram o badge "WhatsApp" - não deveria aparecer
2. Mensagens enviadas não mostram a assinatura do usuário logado

## Causa raiz
- O badge "WhatsApp" é renderizado em `MessageBubble.tsx` linhas 140-145 para todas as mensagens `isOutgoing`
- A assinatura não aparece porque na linha 160 de `MessageArea.tsx`: `showOnRight && !isOutgoing` exclui mensagens WhatsApp outgoing
- Mesmo se passasse `msg.sender_name`, seria o nome errado (admin do sistema, não o usuário logado) porque a edge function grava `sender_id` como o primeiro admin

## Solução

### 1. `src/components/chat/MessageBubble.tsx`
- Remover o bloco do badge "WhatsApp" (linhas 140-145) das mensagens outgoing

### 2. `src/components/chat/MessageArea.tsx`
- Adicionar prop `currentUserName?: string` ao componente
- Para mensagens outgoing, passar `currentUserName` como `senderName` (em vez de `msg.sender_name` que é o admin errado)
- Para mensagens internas (`text`) do usuário logado, continuar usando `msg.sender_name`

### 3. `src/pages/Chat.tsx`
- Passar `currentUserName={profile?.full_name}` ao `MessageArea`

## Arquivos
| Arquivo | Mudança |
|---------|--------|
| `src/components/chat/MessageBubble.tsx` | Remover badge "WhatsApp" (~5 linhas) |
| `src/components/chat/MessageArea.tsx` | Adicionar prop `currentUserName`, usar para outgoing (~3 linhas) |
| `src/pages/Chat.tsx` | Passar `currentUserName={profile?.full_name}` (~1 linha) |

