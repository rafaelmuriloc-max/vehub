

# Indicadores de mensagem estilo WhatsApp

## Problema atual
Os indicadores de entrega/leitura usam ícones genéricos: um `Check` cinza para entregue e `CheckCheck` azul para lido. No WhatsApp real, a lógica é:
- ✓ (um check cinza) = enviada
- ✓✓ (dois checks cinza) = entregue
- ✓✓ (dois checks azuis) = lida

Atualmente, mensagens não lidas mostram um único check, e lidas mostram dois checks azuis. Falta o estado intermediário "entregue" (dois checks cinza).

## Solução

### `src/components/chat/MessageBubble.tsx` (linhas 157-161)

Alterar a lógica dos ícones para replicar o padrão WhatsApp:

- **Enviada (não lida)**: `CheckCheck` com cor cinza (`text-muted-foreground`) — no WhatsApp, mensagens enviadas pelo servidor já mostram dois checks cinza (entregue). Como não temos estado separado de "enviada mas não entregue", tratamos toda mensagem não lida como entregue (dois checks cinza).
- **Lida**: `CheckCheck` com cor azul (`text-blue-500`)

Ambos os estados usam `CheckCheck` (dois checks). A diferença é apenas a cor: cinza = entregue, azul = lida.

Remover o ícone `Check` (check único) da importação se não for mais usado. O check único só faria sentido se tivéssemos um estado "sending/pending", que não existe no modelo atual.

## Arquivo
- `src/components/chat/MessageBubble.tsx`

