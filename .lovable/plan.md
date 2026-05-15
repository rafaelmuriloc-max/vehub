## Mostrar anexos ao abrir card da tarefa

No diálogo de edição da tarefa (`Tasks.tsx`), exibir os documentos previamente anexados.

### Alterações em `src/pages/Tasks.tsx`

- Novo estado `editAttachments: Array<{ id; file_name; file_url; file_size; file_type }>`.
- `openEdit(task)`: passa a buscar `task_attachments` via `supabase.from('task_attachments').select('*').eq('task_id', task.id)` e popula `editAttachments`.
- No diálogo "Editar Tarefa", nova seção **Anexos**:
  - Lista cada arquivo com ícone `Paperclip`, nome, tamanho e botão de download (gera signed URL do bucket `documents` e abre em nova aba).
  - Botão remover (ícone `X`) — apaga registro `task_attachments` e o objeto do storage; permitido para o uploader ou admin (alinhado à RLS atual).
  - Input `<input type="file" multiple>` para anexar novos arquivos à tarefa existente, reutilizando a sanitização de nomes e o caminho `documents/tasks/{taskId}/...` já usado no fluxo "Solicitar".
- Sem mudanças no card do Kanban (o anexo aparece ao abrir a tarefa, conforme solicitado), sem mudanças de schema/RLS.