## Objetivo
Adicionar um campo "Descrição" no diálogo "Solicitar Tarefa" para que o solicitante possa complementar/sobrescrever a descrição vinda do template.

## Mudanças em `src/pages/Tasks.tsx`

1. **`requestForm` state** — adicionar `description: ''`.
2. **`openRequest(tpl)`** — inicializar `description` com `tpl.description || ''`.
3. **Dialog (linhas ~720-740)** — incluir um `<Textarea>` com `Label "Descrição"` logo após o campo de Cliente (largura total).
4. **`handleRequest`** — usar `requestForm.description || null` ao montar o payload da nova `task` (em vez de `requestTemplate.description`).

Nada de mudanças de schema (a coluna `description` já existe em `tasks`).
