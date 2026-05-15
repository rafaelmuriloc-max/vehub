## Objetivo

Ao clicar no card de uma tarefa dentro do painel de tarefas pendentes do chat, abrir o **mesmo dialog de edição** usado no Kanban (em vez de abrir `/tasks?id=...` em nova aba).

## Contexto

- Hoje, em `PendingTasksPanel.tsx`, o card chama `window.open('/tasks?id=...')`.
- O dialog de edição vive **inline** dentro de `src/pages/Tasks.tsx` (linhas 586–695) e depende de várias funções/estados locais (`form`, `editAttachments`, `uploadEditFiles`, `downloadAttachment`, `removeAttachment`, `handleSave`, `profiles`, `clients`, `departments`, `assignments`).

Para reutilizar exatamente o mesmo dialog no chat, vamos extrair a edição em um componente autocontido.

## Mudanças

### 1. Novo `src/components/tasks/TaskEditDialog.tsx`

Componente reutilizável que recebe:
```ts
{ open: boolean; onOpenChange: (v: boolean) => void; taskId: string | null; onSaved?: () => void }
```

Internamente:
- Ao abrir com `taskId`, carrega em paralelo: `tasks` (a tarefa), `task_assignments` (do task), `task_attachments` (do task), `profiles`, `clients`, `departments`.
- Renderiza exatamente o mesmo formulário de edição já existente em `Tasks.tsx`:
  - Título, Descrição, Status, Prioridade, Prazo, Cliente, Departamento, Atribuir a (badges).
  - Aviso de notificação WhatsApp/E-mail.
  - Listas de anexos `input` (Anexos da solicitação) e `output` (Anexos para o cliente), com download (signed URL), remoção e upload.
- Funções internas: `handleSave`, `uploadFiles(direction)`, `downloadAttachment`, `removeAttachment` — replicando a lógica atual de `Tasks.tsx`.
- Ao salvar com sucesso: fecha e dispara `onSaved?.()`.

### 2. `src/components/chat/PendingTasksPanel.tsx`

- Importar `TaskEditDialog`.
- Adicionar estado `editingTaskId: string | null`.
- Substituir o `onClick` do card:
  - **De**: `onClick={() => window.open('/tasks?id=...', '_blank')}`
  - **Para**: `onClick={() => setEditingTaskId(task.id)}`
- Renderizar `<TaskEditDialog open={!!editingTaskId} onOpenChange={(v) => !v && setEditingTaskId(null)} taskId={editingTaskId} onSaved={loadTasks} />` no final do componente.
- Manter `e.stopPropagation()` nos botões internos (mover status, anexar arquivo, excluir) para não disparar a abertura do dialog.

### 3. `src/pages/Tasks.tsx` (sem refactor obrigatório)

Mantém seu dialog inline atual — não precisamos mexer agora. Em uma iteração futura pode-se trocar pelo novo `TaskEditDialog` para deduplicar.

Sem mudanças em schema, RLS, edge functions ou rotas.