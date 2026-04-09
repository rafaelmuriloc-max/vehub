

# Fix: assinatura mostrando nome do usuário errado

## Causa raiz

Quando uma mensagem WhatsApp é enviada pelo chat, a edge function `whatsapp-send-text` grava `sender_id` como o **primeiro admin do sistema** (não o usuário logado). Quando o UI carrega as mensagens, resolve `sender_id` → perfil e mostra o nome desse admin como assinatura.

Enquanto isso, a assinatura **correta** (`*Nome:*`) já está embutida no **conteúdo** da mensagem (linha 20 da edge function), que aparece no texto da bolha.

Resultado: assinatura duplicada — uma correta (no texto) e outra errada (no cabeçalho da bolha).

## Solução

Duas abordagens possíveis (recomendo a opção A por ser mais limpa):

### Opção A — Remover a assinatura duplicada do cabeçalho da bolha para mensagens WhatsApp

No `MessageArea.tsx`, não passar `senderName` para mensagens WhatsApp outgoing (já que a assinatura está no conteúdo):

```typescript
const isWhatsappOutgoing = msg.message_type === 'whatsapp_outgoing' || msg.message_type === 'whatsapp';
senderName={showOnRight && !isWhatsappOutgoing ? msg.sender_name : undefined}
```

Para mensagens internas (não-WhatsApp), continuar mostrando `msg.sender_name` normalmente.

### Opção B — Corrigir o sender_id na edge function

Passar o `userId` do usuário logado para a edge function e usar esse como `sender_id` ao invés do primeiro admin. Isso requer mudanças na edge function para aceitar e validar o `userId`.

## Recomendação

**Opção A** — é a mais simples e resolve imediatamente. A assinatura já está no texto da mensagem para WhatsApp, então o cabeçalho é redundante.

## Arquivos
| Arquivo | Mudança |
|---------|--------|
| `src/components/chat/MessageArea.tsx` | ~1 linha — não passar `senderName` para msgs WhatsApp outgoing |

