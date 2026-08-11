# Separar painéis de Tarefas e Obrigações no dashboard

## Objetivo
Reorganizar o dashboard para que os painéis de **Tarefas** e **Obrigações** fiquem visualmente separados como duas colunas laterais distintas, com separador vertical, títulos destacados e identidade própria de cada seção.

## Escopo
- Manter os dados e métricas atuais intactos.
- Não alterar funcionalidade, apenas apresentação.
- Preservar os painéis de Clientes e Tickets nas posições atuais.
- Aplicar a separação escolhida: colunas laterais com separador visual.

## Mudanças

### `src/pages/Dashboard.tsx`
- Envolver `TasksPanel` e `ObligationsPanel` em um container de duas colunas (`flex-col` em mobile, `flex-row` a partir de `xl`).
- Adicionar separador vertical (`Separator` ou `div` com `w-px bg-border`) visível apenas em desktop.
- Aumentar o gap horizontal entre as colunas para reforçar a separação.

### `src/components/dashboard/TasksPanel.tsx`
- Destacar o título "Tarefas do mês" com subtítulo/resumo (ex: total de pendentes).
- Aplicar estilo de card mais independente: bordas, sombra sutil e hover.
- Manter os 5 metric cards e o ranking de hoje.
- Garantir que o layout interno aproveite a largura extra da coluna.

### `src/components/dashboard/ObligationsPanel.tsx`
- Destacar o título "Obrigações" com subtítulo/resumo (ex: total vencendo nos próximos 7 dias).
- Aplicar estilo de card mais independente, alinhado ao painel de Tarefas.
- Manter a conclusão por departamento e a lista de vencimentos.
- Garantir que o layout interno aproveite a largura extra da coluna.

## Responsividade
- Em telas menores que `xl`: colunas empilham verticalmente (`flex-col`).
- Em telas `xl` ou maiores: colunas lado a lado (`flex-row`) com separador vertical.

## Critérios de aceitação
- Dashboard exibe Tarefas e Obrigações como duas colunas bem definidas no desktop.
- Separador vertical visível entre as colunas no desktop.
- Títulos e cards de cada painel têm identidade visual própria.
- Nenhum dado ou comportamento existente é perdido.
