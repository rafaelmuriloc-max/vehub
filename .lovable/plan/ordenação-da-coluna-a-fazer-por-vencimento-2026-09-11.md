# Ordenação da coluna "A Fazer" por vencimento

## Objetivo
Na visualização Kanban de Tarefas, a coluna **A Fazer** deve exibir as tarefas ordenadas pelo prazo de vencimento, da mais urgente para a menos urgente. Tarefas sem data de vencimento devem aparecer por último.

## Onde alterar
- `src/pages/Tasks.tsx` — renderização do Kanban (`TabsContent value="kanban"`).

## Como fazer
1. Ao montar `colTasks` dentro do `statusColumns.map`, quando `col === 'todo'`, aplicar ordenação por `due_date` ascendente.
2. Tarefas com `due_date` nulo ou vazio devem ser colocadas no final da lista.
3. Preservar a paginação já existente (10 cards por página) e os controles de página.
4. As demais colunas (`in_progress`, `done`) continuam com a ordem atual.

## Critério de aceitação
- A coluna "A Fazer" mostra primeiro as tarefas com prazo mais próximo.
- Tarefas sem prazo ficam ao final.
- Paginação e contadores continuam funcionando.
- Nenhuma outra aba (Lista, Ranking, Custos, Cadastro) é alterada.
