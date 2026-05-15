## Mudança no Kanban de Tarefas

Reduzir o quadro Kanban para 3 colunas:
- **A Fazer** (`todo`)
- **Aguardando** (`in_progress`)
- **Concluído** (`done`)

A coluna "Em Revisão" (`in_review`) será removida. Tarefas existentes nesse status serão migradas para `in_progress` ("Aguardando").

### Alterações

**`src/pages/Tasks.tsx`**
- `statusLabels`: `{ todo: 'A Fazer', in_progress: 'Aguardando', done: 'Concluído' }`
- `statusColumns`: `['todo', 'in_progress', 'done']`
- Tipo `Task['status']`: `'todo' | 'in_progress' | 'done'`
- Selects de status (filtro e diálogo de edição) refletem as 3 opções
- Tarefas com `in_review` carregadas do banco são exibidas na coluna "Aguardando" (tratamento de fallback)

**Migração SQL**
- `UPDATE public.tasks SET status = 'in_progress' WHERE status = 'in_review';`
- (não removo o valor do enum — caso `status` seja `text`, basta o update; se for enum, mantenho o valor para não quebrar dependências)

Sem mudanças em outras páginas, RLS ou lógica de atribuição.