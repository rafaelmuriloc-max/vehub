## Anexos na solicitação de tarefa

Adicionar suporte a anexos (documentos/imagens) no diálogo "Solicitar Tarefa" da página /tasks.

### Banco de dados

Nova tabela `task_attachments`:
- `task_id` (uuid, FK → tasks)
- `file_url` (text — caminho no bucket `documents`)
- `file_name` (text)
- `file_type` (text)
- `file_size` (int)
- `uploaded_by` (uuid)

RLS: usuários autenticados podem visualizar/inserir; quem subiu (ou admin) pode deletar.

Storage: reutilizar o bucket existente `documents`, prefixo `tasks/{task_id}/{arquivo_sanitizado}`. Nome do arquivo sanitizado conforme regra do projeto (sem espaços/acentos, NFD).

### Frontend (`src/pages/Tasks.tsx`)

Diálogo "Solicitar":
- Novo campo "Anexos" com `<input type="file" multiple>` aceitando imagens e documentos comuns (pdf, doc, xls, png, jpg, etc.).
- Lista pré-upload com nome, tamanho e botão remover.
- Ao submeter: cria a tarefa → faz upload dos arquivos para `documents/tasks/{taskId}/...` → insere registros em `task_attachments`.
- Toast de erro se algum upload falhar (a tarefa permanece criada).

Diálogo "Editar tarefa" (criar/editar manual):
- Mesma seção de anexos, listando os já existentes com link de download (signed URL) e botão remover.

Card do Kanban:
- Pequeno ícone de clipe com contagem de anexos quando houver.

### Fora de escopo
- Pré-visualização inline de imagens.
- Versionamento de arquivos.
- Anexos em massa via drag-and-drop (apenas seletor padrão).
