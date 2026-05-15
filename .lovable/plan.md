## Objetivo

Mostrar as tarefas (`tasks`) no calendário mensal (`/calendar`) no dia da `due_date`, junto com as obrigações já exibidas. Cada tarefa fica visível como um ponto no dia, abre o `TaskEditDialog` ao clicar e respeita os filtros existentes de departamento e empresa (filtro de obrigação não se aplica a tarefas).

## Mudanças (apenas `src/pages/CalendarView.tsx`)

1. Carregar tarefas do mês visível
   - Em `loadData`, junto às outras queries, buscar `tasks` com `due_date >= monthStart AND due_date < monthEnd` selecionando `id, task_number, title, status, priority, due_date, client_id, department_id`.
   - Carregar `task_assignments` apenas dos ids retornados (para contagem futura — opcional, pode ser omitido nessa versão).
   - Guardar em novo state `tasks`.

2. Modelar tarefas como eventos do calendário
   - Estender `CalendarEvent.type` para incluir `'task'` e adicionar `taskId?: string` opcional.
   - Adicionar entrada `task: { label: 'Tarefa', color: 'bg-primary' }` em `typeConfig`.
   - No `useMemo` `events`, após gerar os eventos das instâncias, percorrer `tasks` aplicando os filtros `filterDept` (por `department_id`) e `filterClient` (por `client_id`); ignorar `filterObligation` (tarefas não têm obrigação). Adicionar um evento `{ type: 'task', date: due_date, clientName, deptName, ... taskId, instanceId: task.id, obligationId: '' }` para cada tarefa com `due_date` no mês.
   - Não interferir na deduplicação por `instanceId-date` já existente (taskId entra em outro escopo de chave).

3. Renderizar pontos e lista do dia
   - `getDayDots` passa a contar `task` também (estender o objeto `counts` e o render dos dots no grid para incluir um quarto ponto/cor `bg-primary` quando `counts.task > 0`).
   - Na seção do dia selecionado, abaixo das listas existentes de obrigações, adicionar uma sub-seção "Tarefas" listando os eventos `type === 'task'` do dia. Cada item mostra: número (`#000123`), título, empresa, badge de prioridade (mesmo mapeamento usado em `PendingTasksPanel`) e badge de status. Clique no item abre `TaskEditDialog` com o `taskId`.
   - Importar e renderizar `TaskEditDialog` (já existente em `src/components/tasks/TaskEditDialog.tsx`), controlado por novo state `editingTaskId`.

4. Considerações
   - Tarefas não fazem parte das contagens de "Pendentes/Concluídas" das obrigações; ficam em uma terceira lista própria, sem paginação (assumindo volume baixo por dia — adicionar paginação fica para depois se necessário).
   - Sem mudanças em schema, RPCs, edge functions ou em outras telas.
