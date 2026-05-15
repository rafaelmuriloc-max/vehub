## Objetivo
O botão "+ Nova Tarefa" no topo da página de Tarefas deve abrir o mesmo diálogo "Solicitar Tarefa", acrescentando um seletor para escolher um template já cadastrado **ou** digitar um nome livre.

## Mudanças em `src/pages/Tasks.tsx`

1. **`openNew()`** — em vez de abrir o diálogo de edição, deve:
   - `setRequestTemplate(null)`
   - resetar `requestForm` com `due_date` = hoje + 7 dias, `description=''`, demais campos vazios
   - `setRequestFiles([])`
   - `setRequestOpen(true)`
   - novo estado `requestCustomTitle` ('') para o nome livre

2. **`requestForm`** — adicionar campo opcional `template_id?: string` (ou usar o estado `requestTemplate` existente). Adicionar `requestCustomTitle: string`.

3. **Diálogo "Solicitar"** — quando `requestTemplate` for `null` (entrada via "+ Nova Tarefa"), exibir no topo:
   - Combobox/Select "Tarefa cadastrada (opcional)" listando todos os `templates` (filtrar por departamento que o usuário acessa). Ao selecionar, popula `requestTemplate`, `description` (do template) e `due_date` (com `default_due_days`).
   - Input "Ou digite um nome" — visível/usado quando nenhum template estiver selecionado. Edita `requestCustomTitle`.
   - Título do diálogo passa a "Nova Tarefa" quando `requestTemplate` é `null`; senão "Solicitar: {nome}".

4. **Validação em `handleRequest`**:
   - Cliente continua obrigatório.
   - Se `requestTemplate` existe → comportamento atual (title = template.name, herda department/template_id e flags de notificação).
   - Caso contrário → exigir `requestCustomTitle.trim()`. `title = requestCustomTitle`, `template_id = null`, `department_id = null`, flags de notificação = `false`/`null`.

5. **Botão "+ Nova Tarefa"** — manter no mesmo lugar, apenas o `onClick={openNew}` agora abre o diálogo unificado.

6. **Diálogo de edição (`dialogOpen`)** — permanece para editar tarefas existentes (acionado por `openEdit`). Não removido.

Sem mudanças de schema — `tasks.template_id` e `department_id` já são nullable.
