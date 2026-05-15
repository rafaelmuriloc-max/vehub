## Causa raiz

A query de tarefas no `PendingTasksPanel` usa embeds do PostgREST (`clients(company_name)`, `departments(name)`, `task_assignments(user_id)`), mas a tabela `tasks` **não possui foreign keys** declaradas para `clients`, `departments` nem `task_assignments`. O PostgREST retorna erro `PGRST200`:

> Could not find a relationship between 'tasks' and 'departments' in the schema cache

Resultado: `data` vem `null`, `rows = []`, `onCountChange(0)` é disparado, o painel fecha automaticamente — mesmo havendo a tarefa "Emitir Nota Fiscal" para POUSADA CAMINHO DOS SONHOS LTDA (cliente vinculado ao telefone do Rafael Murilo, confirmado em DB).

Confirmei também que o restante do app (página Tasks) usa `.select('*')` + fetches separados — por isso só este painel quebra.

## Plano

**`src/components/chat/PendingTasksPanel.tsx`** — Reescrever o carregamento para não depender de FKs:

1. Buscar `tasks` apenas com colunas escalares: `select('id,task_number,title,priority,due_date,client_id,created_at,created_by,department_id,status,notify_whatsapp,notify_email,notify_sent_at')` filtrando por `client_id in (ids)` e `status='todo'`.
2. Em paralelo (após obter `rows`), fazer três queries auxiliares com os ids resultantes:
   - `clients`: `select('id,company_name').in('id', clientIds)`
   - `departments`: `select('id,name').in('id', deptIds)` (somente ids não-nulos)
   - `task_assignments`: `select('task_id,user_id').in('task_id', taskIds)`
3. Montar maps (`clientMap`, `deptMap`, `assignmentsByTask`) e compor cada `TaskRow` com os campos `clients`, `departments`, `task_assignments` esperados pelo render existente — sem alterar o JSX.
4. Manter `profileMap` e `loadAttachmentCounts` como já estão.

Sem mudanças de schema, RLS, edge functions ou outros arquivos. O painel volta a aparecer para o Rafael Murilo (e qualquer contato com tarefas vinculadas).