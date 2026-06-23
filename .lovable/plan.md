
## Problema

Quando alguém da equipe (ex.: Márcio) envia uma **nota interna** (`channel = 'internal'`, `message_type = 'text'`) dentro de uma conversa de WhatsApp, a mensagem aparece no **lado correto (direita)** apenas para o próprio autor. Para os demais atendentes que abrem a mesma conversa, a bolha cai no **lado esquerdo**, como se fosse mensagem do cliente.

Causa: o `MessageBubble` decide o lado com a regra
`showOnRight = isWhatsAppOutgoing || (!isIncoming && isMine)`,
e `isMine` é `sender_id === currentUserId`. Para mensagens internas (`text`) o `message_type` não tem prefixo `whatsapp_`, então recai no `isMine` — quebrando a visualização para os outros usuários.

Confirmado no banco: na conversa "Neto L.L" há mensagem `text` do Márcio (`sender_id = 0b2ec2d8…`, `channel = internal`). Para Rafael/Bruno ela aparece à esquerda.

## Solução

Notas internas feitas por qualquer membro da equipe devem **sempre** aparecer à direita (lado da empresa), independentemente de quem está logado. Mensagens vindas do cliente continuam à esquerda; permissões de editar/excluir continuam atreladas a `isMine`.

### Alterações

1. **`src/components/chat/MessageBubble.tsx`**
   - Adicionar prop opcional `channel?: string | null` na interface.
   - Atualizar a regra de posicionamento para:
     ```
     const isInternalTeamNote = channel === 'internal' && !isIncoming;
     const showOnRight = isWhatsAppOutgoing || isInternalTeamNote || (!isIncoming && isMine);
     ```
   - Não mexer em `canEdit` / `canDeleteForAll` (continuam usando `isMine` / `isAdmin`).

2. **`src/components/chat/MessageArea.tsx`**
   - Recalcular `showOnRight` localmente com a mesma fórmula para definir `senderName` corretamente (mostrar nome do autor quando a bolha vai para a direita em conversas de grupo / notas internas).
   - Passar `channel={msg.channel}` ao `<MessageBubble />`.

### Fora de escopo

- Não alterar a lógica do webhook nem o `sender_id` aleatório das mensagens `whatsapp_incoming` (assunto separado).
- Não mudar o estilo/cor da bolha de nota interna — apenas o lado.
