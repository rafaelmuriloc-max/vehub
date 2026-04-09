

# Corrigir assinatura de mensagens e nome do contato no chat

## Problemas (conforme screenshot)

1. **Nome do contato mostra nome da empresa**: O webhook (`whatsapp-webhook`) define `conv.name` como `contact_name || company_name` (linha 231). Deveria usar `pushName` do WhatsApp quando disponível.

2. **Mensagens enviadas (direita) sem assinatura**: No `MessageBubble.tsx` linha 137, `senderName` só é exibido quando `!showOnRight`. Ou seja, mensagens à direita nunca mostram o nome.

3. **Mensagens recebidas (esquerda) com assinatura**: No `MessageArea.tsx` linha 156, `senderName` é passado quando `msg.sender_id === currentUserId`. Mensagens internas do próprio usuário que aparecem à esquerda (por tipo de mensagem) mostram o nome indevidamente.

## Alterações

### 1. `src/components/chat/MessageBubble.tsx`
- Remover a condição `!showOnRight` da exibição do `senderName` (linha 137)
- Mostrar `senderName` em mensagens à direita (enviadas) como assinatura

### 2. `src/components/chat/MessageArea.tsx`
- Inverter a lógica da linha 156: passar `senderName` apenas para mensagens do próprio usuário que aparecem à **direita** (enviadas)
- Para mensagens que não são do usuário atual, nunca passar `senderName`

Lógica corrigida:
```typescript
senderName={msg.sender_id === currentUserId ? msg.sender_name : undefined}
```
Essa parte já está correta — o problema é no MessageBubble que só mostra à esquerda.

### 3. `supabase/functions/whatsapp-webhook/index.ts`
- Na criação/atualização de conversa, priorizar `pushName` sobre `clientName` para o campo `name`
- Linha 260: usar `pushName || clientName` ao invés de `clientName`
- Linha 388: atualizar também nomes genéricos com `pushName` quando disponível
- Na criação de nova conversa: usar `pushName || clientName`

### 4. `src/pages/Chat.tsx`
- Na resolução de nomes (linha 123), a lógica já prioriza `conv.name` para WhatsApp. O problema é que `conv.name` no DB está com o nome da empresa. Após o fix no webhook, novas conversas terão o pushName. Para conversas existentes, pode-se forçar uma atualização na próxima mensagem recebida.

## Resumo de arquivos
| Arquivo | Mudança |
|---------|---------|
| `src/components/chat/MessageBubble.tsx` | Mostrar senderName também à direita (~2 linhas) |
| `src/components/chat/MessageArea.tsx` | Sem mudança (lógica já correta) |
| `supabase/functions/whatsapp-webhook/index.ts` | Priorizar pushName para conv.name (~5 linhas) |

## Resultado esperado
- Mensagens enviadas pelo chat mostram assinatura (nome do usuário logado)
- Mensagens recebidas não mostram assinatura
- Nome do contato no cabeçalho reflete o pushName do WhatsApp

