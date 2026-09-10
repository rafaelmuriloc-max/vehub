# Aumentar a largura dos gráficos de desempenho

## Objetivo
Ampliar a largura dos medidores (gauges) na página `/calendar` para melhor preenchimento do espaço horizontal, sem alterar cálculos, dados, filtros ou calendário.

## Escopo
- Ajustar `OfficeGauge` (desempenho geral) e `DepartmentGauge` (desempenho por departamento) em `src/pages/CalendarView.tsx`.
- Manter altura, cores, degradê, ponteiro, posicionamento do percentual e comportamento responsivo.
- Apenas aumentar larguras e espaçamentos relacionados.

## Mudanças técnicas
1. `OfficeGauge`: aumentar largura de `240px` para `320px` (desktop de `280px` para `380px`); ajustar `viewBoxWidth`, `cx` e `radius` do `GaugeArc` proporcionalmente.
2. `DepartmentGauge`: aumentar `min-w` de `240px` para `300px` e largura do SVG de `220px` para `280px`; ajustar `viewBoxWidth`, `cx` e `radius` proporcionalmente.
3. Revisar `strokeWidth` e tamanho da fonte para manter legibilidade com mais espaço.
4. Verificar container de rolagem horizontal e gaps para evitar corte.

## Validação
- Typecheck e build devem passar.
- Preview deve mostrar medidores mais largos, sem distorção do arco ou sobreposição do ponteiro sobre o número.
