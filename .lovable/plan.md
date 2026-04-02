

# Corrigir visibilidade de conversas transferidas na aba "Todos"

## Problema

Dois problemas combinados:

1. **Aba "Todos"** filtra apenas `status = 'open'` — conversas fechadas transferidas não aparecem
2. **Aba "Atendidos"** filtra por `assigned_to = user.id` — após transferir, o usuário original perde acesso porque o `assigned_to` mudou

No caso específico: a conversa "Rafael Murilo" foi transferida para Bruno e está com `status = 'closed'`, então não aparece em nenhuma aba para o usuário original.

## Solução

Ajustar os filtros da aba "Todos" para mostrar **todas as conversas** (abertas e fechadas) em vez de apenas as abertas. Isso garante que qualquer membro da equipe possa ver todas as conversas, incluindo as transferidas.

### Alteração em `src/pages/Chat.tsx`

Na função `loadConversations`, linha ~40-41, trocar o filtro da aba "all":

**Antes:**
```typescript
} else {
  query = query.eq('status', 'open');
}
```

**Depois:**
```typescript
} else {
  // all: todas as conversas (abertas e fechadas)
  // sem filtro de status nem de assigned_to
}
```

Isso remove o filtro `eq('status', 'open')` da aba "Todos", permitindo que todas as conversas sejam listadas independentemente do status ou de quem está atribuído.

### RLS

A política "Authenticated users can view all open conversations" só permite ver conversas com `status = 'open'`. Para que conversas fechadas também apareçam na aba "Todos", é preciso **adicionar uma nova política RLS** ou **alterar a existente** para permitir que usuários admin vejam todas as conversas:

```sql
CREATE POLICY "Admins can view all conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

Isso garante que administradores possam ver todas as conversas (abertas e fechadas) na aba "Todos".

## Arquivos
- `src/pages/Chat.tsx` (~2 linhas alteradas)
- Migration: nova política RLS em `chat_conversations`

