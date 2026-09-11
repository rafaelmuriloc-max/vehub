# Paginação no Kanban de Tarefas

Cada coluna do Kanban (A Fazer, Aguardando, Concluído) passa a mostrar no máximo 10 cards por vez, com navegação de páginas na própria coluna.

## Como vai funcionar

- Cada coluna mostra até 10 tarefas.
- Abaixo dos cards aparece um controle discreto: "Anterior / Página X de Y / Próxima", exibido só quando a coluna tem mais de 10 tarefas.
- O total de tarefas da coluna continua no selo ao lado do título.
- Ao mudar filtros, ou quando uma tarefa muda de coluna e a página atual fica vazia, a coluna volta para a primeira página.
- Nada muda nas abas Lista, Ranking, Custo por Cliente e Cadastro.

## Detalhes técnicos

Arquivo: `src/pages/Tasks.tsx` (apenas apresentação/estado local).

1. Novo estado `kanbanPage: Record<string, number>` com página por coluna (default 1) e constante `KANBAN_PAGE_SIZE = 10`.
2. `useEffect` reseta `kanbanPage` para 1 quando qualquer filtro/busca muda.
3. Na renderização da coluna: `const colTasks = filteredTasks.filter(t => t.status === col)`, `totalPages = Math.max(1, Math.ceil(colTasks.length / 10))`, `page = Math.min(kanbanPage[col] ?? 1, totalPages)` e `colTasks.slice((page-1)*10, page*10)` para os cards.
4. Rodapé da coluna com dois `Button` ghost (ChevronLeft/ChevronRight) desabilitados nos extremos, renderizado apenas se `totalPages > 1`.
