## Mudança em `src/components/chat/TaskRequestForm.tsx`

1. Carregar `profiles` incluindo `department_id`: `select('user_id, full_name, department_id')` e atualizar o type `Profile`.
2. Substituir o grupo de Badges por um `<Select>` (lista suspensa) — single-select de "Atribuir a", já que o tipo do select padrão atende. Manter `assigned_to` como array para compatibilidade com `task_assignments` (insere 1 item).
3. Filtrar a lista exibida:
   - Se `requestTemplate?.department_id` existir → mostrar apenas profiles com `department_id === requestTemplate.department_id` (admins sem departamento são incluídos opcionalmente — incluir somente quem bate com o departamento).
   - Se nenhum template selecionado → mostrar todos.
4. Incluir item "— Livre para o departamento —" (valor `none`) que limpa `assigned_to`.
5. Resetar `assigned_to` ao trocar de template.

Sem mudanças de schema, backend ou outros arquivos.