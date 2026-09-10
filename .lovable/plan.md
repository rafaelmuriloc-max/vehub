# Alinhar cards menores ao centro do card de desempenho geral

## Objetivo
Fazer com que os quatro cards de KPIs fiquem alinhados horizontalmente e centralizados verticalmente em relação ao card maior de "Desempenho geral da operação", mas mantendo a altura compacta original dos cards menores (não esticá-los para a altura do card grande).

## Alterações
1. Em `src/pages/CalendarView.tsx`, no grid que envolve os cards de KPIs e o gauge:
   - Trocar `items-stretch` por `items-center` para centralizar verticalmente o bloco dos cards menores ao card grande.
   - Remover `h-full` e `flex-col justify-center` dos cards menores, mantendo-os compactos como estavam originalmente.
   - Preservar o layout em uma única linha em `xl` (`xl:grid-cols-4`).
2. Manter o card de desempenho geral com sua altura natural e conteúdo centralizado.
3. Não alterar cálculos, dados, cores, fontes, textos nem comportamentos funcionais.
