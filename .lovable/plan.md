# Separar visualmente Tarefas e Obrigações no dashboard

## Diagnóstico
No `src/pages/Dashboard.tsx` os dois painéis já estão em um container de colunas, mas a divisão só é aplicada a partir do breakpoint `xl` (1280px). A tela atual tem 1090px de largura, então as colunas empilham verticalmente e o separador (`hidden xl:block`) fica oculto — dando a impressão de um único painel contínuo.

## Mudanças

### `src/pages/Dashboard.tsx`
- Trocar o breakpoint das colunas de `xl` para `lg` (1024px), para que em telas como a atual (1090px) os painéis fiquem lado a lado.
- Aplicar o mesmo ajuste ao separador vertical (`hidden lg:block`).
- Adicionar um título de seção acima de cada coluna quando empilhado, para que em telas menores ainda fique claro que são blocos distintos.

### `src/components/dashboard/TasksPanel.tsx` e `ObligationsPanel.tsx`
- Reforçar a identidade de cada card: borda mais evidente (`border-2 border-border/70`) e uma faixa de cor no topo do card (accent) diferenciando Tarefas de Obrigações.
- Ajustar a grade interna dos metric cards de Tarefas para `grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5`, já que a coluna passa a ser mais estreita a partir de `lg`.

## Critérios de aceitação
- Em 1090px de largura, Tarefas e Obrigações aparecem lado a lado com separador visível.
- Em telas menores, os painéis empilham mas permanecem visualmente distintos (borda + faixa de cor + título próprio).
- Nenhum dado ou comportamento existente é alterado.
