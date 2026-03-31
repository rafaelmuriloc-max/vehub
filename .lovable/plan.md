

# Remover nome do remetente e indicador "WhatsApp recebido" das mensagens recebidas

## Problema
Nas mensagens recebidas (incoming WhatsApp), o balão mostra o nome do remetente (ex: "Rafael Murilo Celestino") e o indicador "WhatsApp recebido" dentro do corpo da mensagem. O usuário quer que apareça apenas o texto da mensagem.

## Alteração

### `src/components/chat/MessageBubble.tsx`
- Remover o bloco que exibe o nome do remetente em mensagens incoming (`📱 {senderName || 'Cliente'}`)
- Remover o bloco do indicador WhatsApp (`Phone icon + "WhatsApp recebido"`) para mensagens incoming
- Manter esses indicadores apenas para mensagens enviadas (outgoing), se aplicável

