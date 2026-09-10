# Ajuste de altura do card de desempenho geral

## Objetivo
Reduzir um pouco mais a altura do card "Desempenho geral da operação" (escritório) em `src/pages/CalendarView.tsx`, mantendo o layout dos demais elementos.

## Escopo
- Alterar apenas classes de altura/padding do card de desempenho geral em `src/pages/CalendarView.tsx`.
- Preservar o medidor `GaugeArc`, título, subtítulo, comparação e responsividade.
- Não alterar dados, cálculos, filtros, calendário ou outros cards.

## Validação
- `typecheck` e build devem passar.
- Verificar visualmente no preview que o card ficou mais compacto sem cortar conteúdo.
