## Fix: chamados atribuídos não aparecem no Dashboard

### Causa
No `TicketsPanel.tsx`, as queries usam joins implícitos do PostgREST:
```ts
profile:assigned_to(full_name, tag_color)
```
Mas `chat_conversations.assigned_to` **não tem foreign key** declarada para `profiles` (e `profiles` usa `user_id`, não `id`). O embed retorna `null` para todas as linhas, então o agrupamento "Por atendente" fica vazio e o card "Aguardando 1ª resposta" perde o nome do atendente.

O mesmo problema ocorre em `TasksPanel.tsx` no ranking (`profiles:completed_by(...)`).

### Correção
Trocar os embeds por buscas separadas + map por `user_id`:

1. **TicketsPanel**
   - Buscar conversas abertas só com `assigned_to`.
   - Buscar `profiles` (`user_id, full_name, tag_color`) onde `user_id IN (...)`.
   - Construir o agregado por atendente no cliente.
   - Idem para `awaiting`: trazer o nome/cor do atendente via map.

2. **TasksPanel**
   - Buscar completions de hoje só com `completed_by`.
   - Buscar profiles dos `completed_by` únicos em uma segunda query.
   - Montar o ranking via map.

Sem mudanças de banco, sem RLS — só ajustes no frontend dos dois componentes.
