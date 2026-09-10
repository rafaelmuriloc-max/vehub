# Ajustar ponteiros dos gauges para não cobrir os números

## Problema
No painel de Calendário, os ponteiros dos medidores de desempenho (geral e por departamento) estão sobrepostos aos percentuais, dificultando a leitura.

## Solução
1. Em `src/pages/CalendarView.tsx`, refatorar o componente `GaugeArc` para desenhar apenas o arco colorido e o ponteiro, sem o texto do percentual.
2. Aumentar levemente o raio/altura do SVG para garantir que o ponteiro tenha margem e não invada a área reservada ao número.
3. Mover o percentual para fora do SVG, renderizado abaixo do gauge no componente pai (`DepartmentGauge` e `OfficeGauge`).
4. Ajustar o ponteiro para ficar mais curto e grosso, com círculo central preto maior, conforme a referência visual enviada.
5. Manter o degradê vermelho → laranja → amarelo → verde e as dimensões responsivas.
6. Executar typecheck e build para validar.

## Escopo
- Apenas `src/pages/CalendarView.tsx`.
- Nenhuma alteração em dados, backend, banco ou outros componentes.
