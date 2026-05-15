## Padronizar card de tarefas

Aplicar o mesmo conjunto de informações em ambos os cards (Kanban em `src/pages/Tasks.tsx` e painel de pendências em `src/components/chat/PendingTasksPanel.tsx`).

### Campos exibidos no card
1. Número sequencial (gerado automaticamente)
2. Nome da empresa (clientes vinculados)
3. Departamento
4. Tarefa (título)
5. Data e hora da solicitação (`created_at`)
6. Nome do criador (`created_by` → profile)
7. Usuários atribuídos
8. Prazo de entrega (`due_date`) com cor por urgência
9. Ícone de anexos (entrada/saída) com contagem
10. Botão "Anexar para o cliente" (upload `direction:'output'`)
11. Botão de excluir

### Mudança no banco (migration)
- Adicionar coluna `task_number BIGINT` em `tasks`, preenchida por uma `SEQUENCE` (ex.: `tasks_task_number_seq`) via `DEFAULT nextval(...)` e `NOT NULL`.
- Backfill: numerar tarefas existentes em ordem de `created_at` antes de aplicar `NOT NULL`.
- Exibir como `#000123` (padding com zeros à esquerda — 6 dígitos) no front.

### Frontend — Kanban (`Tasks.tsx`)
- Buscar `task_number`, `created_at`, `created_by`, `department_id` no `select` da query de tasks (já são selecionadas em `*`, então só usar).
- Carregar mapa de departamentos (id → nome) junto com os profiles.
- Reorganizar `Card`/`CardContent` na seção Kanban (linhas 410–454) para:
  - Topo: `#número` à esquerda, badge de prioridade à direita.
  - Título da tarefa (negrito).
  - Linha "Empresa · Departamento".
  - Linha "Solicitado em dd/MM/yyyy HH:mm por <criador>".
  - Linha "Atribuído: <badges>".
  - Linha "Prazo: dd/MM/yyyy" colorido.
  - Rodapé: ícones de anexo (entrada/saída) + botão "Para o cliente" + botão excluir.
- Manter botões de mover status (já existentes) acima do rodapé.

### Frontend — Painel do chat (`PendingTasksPanel.tsx`)
- Atualizar `TaskRow` com `task_number`, `created_at`, `created_by`, `department_id`.
- Carregar profiles (nomes) e departamentos junto com os já buscados.
- Replicar exatamente o mesmo layout do Kanban para consistência visual.

### Não alterar
- Lógica de status, notificações, fluxo de envio ao cliente, RLS.
- Demais views (Lista, Calendário) — só o card.