## Objetivo
Permitir pesquisar conversas também pelo nome das empresas vinculadas ao contato (campo `companyNames` já presente em `ConversationItem`).

## Mudança
Arquivo: `src/components/chat/ConversationList.tsx` (linhas 105-107)

Estender o filtro de busca para considerar tanto o nome da conversa quanto qualquer empresa em `companyNames`:

```ts
const q = search.trim().toLowerCase();
const filtered = conversations.filter(c => {
  if (!q) return true;
  if (c.name.toLowerCase().includes(q)) return true;
  return (c.companyNames ?? []).some(n => n.toLowerCase().includes(q));
});
```

Sem alterações de banco, edge function ou outras telas — `companyNames` já é populado no `Chat.tsx` a partir do contexto de empresas vinculadas.