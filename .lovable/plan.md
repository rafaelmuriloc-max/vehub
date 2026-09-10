# Alinhar cards menores ao card de desempenho geral

## Objetivo
Fazer com que os quatro cards de KPIs ("A fazer", "Atrasadas", "Concluídas", "Fora do prazo") fiquem visualmente alinhados e centralizados ao card maior de "Desempenho geral da operação", como na imagem de referência.

## Alterações
1. Em `src/pages/CalendarView.tsx`, no grid que envolve os cards de KPIs e o gauge:
   - Garantir que o container dos quatro cards estique para a mesma altura do card de desempenho geral.
   - Em `xl`, manter os quatro cards em uma única linha (`xl:grid-cols-4`).
   - Fazer cada card menor ocupar `100%` da altura disponível (`h-full`).
   - Centralizar verticalmente o conteúdo interno de cada card menor.
2. Preservar o comportamento responsivo: em telas menores que `xl`, os cards devem continuar empilhando de forma adequada.
3. Não alterar cálculos, dados, cores, fontes, textos nem comportamentos funcionais.
