

# Corrigir ordenação cronológica das conversas

## Problema
A migração de consolidação de duplicatas atualizou o `updated_at` de todas as conversas para timestamps sequenciais em `2026-04-07 02:33:xx`, quebrando a ordenação. Por exemplo, JORGE LUIZ aparece primeiro (última msg em 02/04), enquanto WILLIAN PALMEIRA (última msg em 06/04 22:38) aparece muito abaixo.

## Solução em 2 partes

### 1. Migração — Corrigir `updated_at` com base na última mensagem real
```sql
UPDATE chat_conversations c
SET updated_at = COALESCE(
  (SELECT MAX(created_at) FROM chat_messages WHERE conversation_id = c.id),
  c.created_at
);
```

### 2. Ordenação no cliente — Usar `lastMessageAt` como fallback
Em `src/pages/Chat.tsx`, após montar o array `items`, ordenar pelo timestamp da última mensagem (que já é calculado a partir de `chat_messages`):

```typescript
items.sort((a, b) => 
  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
);
```

Isso garante que mesmo se `updated_at` ficar desatualizado no futuro, a lista sempre reflete a ordem real das mensagens.

## Arquivos alterados
- Nova migração SQL — corrige `updated_at` existentes
- `src/pages/Chat.tsx` — 3 linhas adicionadas (sort client-side)

