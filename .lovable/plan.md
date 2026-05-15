## Objetivo

Mostrar um ícone (CheckSquare/clipboard) no canto inferior direito do card do contato na lista de conversas quando aquele contato tiver tarefas pendentes (`tasks.status = 'todo'`).

## Mudanças

### 1. `src/pages/Chat.tsx` (loader de conversas)

No loader que monta `items`, após calcular `whatsappCompanyMap` (que já mapeia conv → matchedClientIds via telefone), também guardar um `Map<convId, string[]>` com os `clientIds` matchados. Em paralelo às queries existentes (`clients`, `participants`, `whatsappContactsResult`), juntar todos os clientIds (matched WhatsApp + `conv.client_id` direto) e fazer:

```ts
supabase.from('tasks')
  .select('client_id')
  .in('client_id', allClientIds)
  .eq('status', 'todo')
```

Construir `pendingByClient: Map<clientId, number>`. Para cada conversa, somar contagens dos seus matched clientIds + clientId direto. Adicionar campo `pendingTasksCount` no item.

### 2. `src/components/chat/ConversationList.tsx`

- Adicionar `pendingTasksCount?: number` em `ConversationItem`.
- Tornar o `<button>` do card `relative` e renderizar, quando `pendingTasksCount > 0`, um pequeno badge absoluto no canto inferior direito:
  - ícone `ClipboardList` da `lucide-react`
  - número de tarefas ao lado (se > 0)
  - cor primária (laranja do tema), com `title` "N tarefa(s) pendente(s)"
  - posicionamento `absolute bottom-1.5 right-2` com `pointer-events-none`

Sem mudança de schema/RLS. Tarefas já são visíveis para `authenticated`.
