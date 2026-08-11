# Filtros na página de Tarefas

Adicionar uma barra de filtros compartilhada por Cliente, Departamento, Tarefa (modelo/título) e Responsável, aplicada tanto no Kanban quanto na Lista.

## Como vai funcionar

- Uma barra de filtros única acima das abas Kanban/Lista, com:
  - **Cliente**: combobox pesquisável (nome, CNPJ e código SCI), no padrão já usado no sistema.
  - **Departamento**: seleção simples com a lista de departamentos.
  - **Tarefa**: seleção do modelo de tarefa cadastrado + campo de busca livre por título/número da tarefa.
  - **Responsável**: seleção do usuário atribuído (inclui opção "Sem responsável").
- Os filtros existentes (Status e Prioridade) continuam, agora na mesma barra e valendo também para o Kanban.
- Botão "Limpar filtros" aparece quando algum filtro está ativo, com indicação de quantos resultados foram encontrados.
- As colunas do Kanban passam a contar apenas as tarefas filtradas.
- A aba "Cadastro" mantém seu filtro próprio de departamento, sem alteração.

## Detalhes técnicos

Arquivo: `src/pages/Tasks.tsx` (somente apresentação/estado local; nenhuma mudança de banco).

1. Novos estados: `filterClient`, `filterDepartment`, `filterTemplate`, `filterAssignee`, `search` (todos default `'all'` / `''`).
2. Extrair a barra de filtros para um bloco renderizado antes de `<Tabs>`, reutilizando `Select` para departamento/modelo/responsável/status/prioridade e o padrão Popover+Command (Combobox) para cliente, exibindo `formatClientLabel`.
3. Ampliar `filteredTasks` para aplicar todos os critérios; responsável usa o mapa `assignments` (`assignments[task.id]?.includes(userId)`), e "Sem responsável" filtra tarefas sem entradas.
4. Trocar `tasks.filter(t => t.status === col)` no Kanban por `filteredTasks.filter(...)`, tanto na contagem do badge quanto na renderização.
5. Busca livre compara título, descrição e `task_number` (normalizada, sem acentos, case-insensitive).
