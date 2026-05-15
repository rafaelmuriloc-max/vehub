## Mudança

Em `src/components/chat/ConversationList.tsx` (linha 219), no `<button>` de cada conversa, aplicar condicionalmente o fundo `#F0F2F5` (claro) / `bg-zinc-800` (escuro) quando `conv.id === activeId` — exatamente o mesmo tom usado hoje no `hover:bg-*`.

Antes:
```
className="... hover:bg-[#F0F2F5] dark:hover:bg-zinc-800 ... bg-white ..."
```

Depois:
```
className={`... hover:bg-[#F0F2F5] dark:hover:bg-zinc-800 ... ${
  conv.id === activeId
    ? 'bg-[#F0F2F5] dark:bg-zinc-800'
    : 'bg-white dark:bg-zinc-900'
} ...`}
```

Nenhum outro arquivo precisa ser alterado — `activeId` já é passado como prop ao `ConversationList`.
