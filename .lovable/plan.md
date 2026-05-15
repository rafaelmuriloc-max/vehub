## Anexos para o cliente nas tarefas

Separar anexos da tarefa em duas categorias e adicionar botão de upload direto no card.

### Banco

- Adicionar coluna `direction text not null default 'input'` em `task_attachments` com check `('input','output')`.
- `'input'` = arquivos enviados na solicitação (necessários para realizar a tarefa).
- `'output'` = arquivos para o cliente (resultado/entrega).
- Linhas existentes ficam como `input`.

### `src/pages/Tasks.tsx`

- Tipo `TaskAttachment` ganha campo `direction`.
- Estado por tarefa carregando contadores de anexos `input`/`output` para badges no Kanban.
- **Card do Kanban**: novo botão pequeno com ícone de upload ("Para o cliente"), abre seletor de arquivo direto. Após upload, badge mostra contagem de anexos `output`.
- **Diálogo de edição da tarefa**: a seção atual "Anexos" passa a ter duas subseções:
  - "Necessários para a tarefa" (`input`) — comportamento atual.
  - "Para enviar ao cliente" (`output`) — mesma UI (lista, download, remover, anexar novos).
- Upload via card e via diálogo usam o mesmo path `documents/tasks/{taskId}/{ts}_{nome}` com `direction` apropriado.
- Botão "Solicitar" continua gravando como `input`.

Sem mudanças em RLS (políticas atuais cobrem o novo campo) e sem envio automático ao cliente — apenas armazenamento.