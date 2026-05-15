## Capturar departamento na criação/edição da tarefa

O card já exibe o departamento quando `task.department_id` está preenchido, mas hoje só os templates definem esse campo. Tarefas criadas pelo botão "Nova Tarefa" e pelo formulário de solicitação sem template ficam sem departamento, então a informação não aparece.

### Mudanças

1. **`src/pages/Tasks.tsx` — diálogo Nova/Editar Tarefa**
   - Adicionar campo `department_id` no estado `form` (init `''`).
   - Popular `form.department_id` em `openEdit` (a partir de `task.department_id`).
   - Inserir um `<Select>` "Departamento" no grid da Dialog (ao lado de Status/Prioridade/Prazo/Cliente), listando `departments`.
   - Incluir `department_id: form.department_id || null` no `payload` do `handleSave` (insert e update).

2. **`src/components/chat/TaskRequestForm.tsx` — solicitar sem template**
   - Adicionar `department_id` ao estado do formulário (default vazio; preenchido pelo template quando selecionado).
   - Mostrar `<Select>` "Departamento" quando não houver template (mantendo o atual quando vier do template).
   - Usar `requestTemplate?.department_id || form.department_id || null` no insert.

### Não muda
- Schema (campo `department_id` já existe em `tasks`).
- Layout do card (já renderiza "Empresa · Departamento").
- RLS, edge functions, fluxo de notificação.