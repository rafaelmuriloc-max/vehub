

# Corrigir duplicação de mensagens enviadas no chat

## Problema
Quando uma mensagem é enviada via WhatsApp:
1. A edge function `whatsapp-send-text` insere a mensagem no `chat_messages` → realtime adiciona na UI
2. O webhook recebe a mesma mensagem de volta como `fromMe` e pode inserir novamente → realtime adiciona de novo na UI

A subscription realtime (linha 227 do Chat.tsx) faz `setMessages(prev => [...prev, newMsg])` sem verificar se o `id` já existe no array.

## Solução
Adicionar verificação de duplicidade no handler do realtime em `src/pages/Chat.tsx`.

### Alteração (linha ~227)
```typescript
setMessages(prev => {
  if (prev.some(m => m.id === newMsg.id)) return prev;
  return [...prev, {
    ...newMsg,
    sender_name: prof?.full_name || 'Usuário',
  }];
});
```

## Arquivo
- `src/pages/Chat.tsx` (~2 linhas alteradas)

