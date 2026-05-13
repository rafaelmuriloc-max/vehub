## Bug
Em `MessageArea.tsx`, mensagens de saída (`whatsapp_outgoing` / `whatsapp`) exibem sempre `currentUserName` (usuário logado) como assinatura, ignorando quem de fato enviou. Por isso, mensagens enviadas por colegas aparecem com o seu nome no seu lado da tela.

## Correção
Em `src/components/chat/MessageArea.tsx`, alterar a linha:

```tsx
senderName={showOnRight ? (isOutgoing ? currentUserName : msg.sender_name) : undefined}
```

para:

```tsx
senderName={showOnRight ? msg.sender_name : undefined}
```

Assim a assinatura sempre vem de `msg.sender_name`, que já é resolvido em `Chat.tsx` via lookup na tabela `profiles` pelo `sender_id` real da mensagem (tanto no carregamento inicial quanto no realtime). O fallback continua sendo `'Usuário'` quando o profile não é encontrado.

## Escopo
- Apenas alteração visual/presentacional em `MessageArea.tsx`.
- Sem mudanças em backend, schema ou lógica de envio.
- A prop `currentUserName` pode permanecer (não vou removê-la para evitar mexer em `Chat.tsx`), apenas deixa de ser usada para definir a assinatura.