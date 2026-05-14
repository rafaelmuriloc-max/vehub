## Remover preview da última mensagem na lista de conversas

Em `src/components/chat/ConversationList.tsx` (linhas 242–249), remover apenas o `<span>` que mostra `conv.lastMessage` (texto "Sem mensagens" como fallback), mantendo o badge de não lidas (`conv.unreadCount`) que vive no mesmo container.

### Mudança
Substituir o bloco:

```tsx
<div className="flex items-center justify-between mt-0.5">
  <span className="text-xs text-muted-foreground truncate">{conv.lastMessage || 'Sem mensagens'}</span>
  {conv.unreadCount > 0 && (
    <span className="ml-2 shrink-0 ...">{conv.unreadCount}</span>
  )}
</div>
```

por uma versão sem o preview, preservando o badge alinhado à direita:

```tsx
{conv.unreadCount > 0 && (
  <div className="flex items-center justify-end mt-0.5">
    <span className="shrink-0 ...">{conv.unreadCount}</span>
  </div>
)}
```

Nada mais é alterado — horário, nome, empresas, badges de status/atribuição e timer de espera continuam iguais.