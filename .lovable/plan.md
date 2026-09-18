# Medidor colorido só até o ponteiro

Ajustar apenas o desenho do arco nos gráficos de desempenho: o arco fica colorido do início até a posição do ponteiro; o restante fica transparente (sem a trilha cinza atual). Percentuais, variação, ponteiro, tamanhos e demais elementos não mudam.

## O que muda visualmente

- O arco colorido (degradê vermelho → laranja → amarelo → verde) passa a terminar exatamente onde está a ponta da agulha, para qualquer percentual.
- A parte do arco além do ponteiro deixa de existir: sem trilha cinza, fundo transparente.
- O ponteiro, o número percentual, a variação "vs. mês anterior" e os cartões permanecem exatamente como estão.
- Vale para o medidor geral ("Desempenho geral da operação") e para os três departamentais, pois ambos usam o mesmo componente.

## Detalhes técnicos

Arquivo: `src/components/performance/gauges.tsx`, componente `GaugeArc`.

- Remover o primeiro `<path>` da trilha cinza (`stroke-muted`).
- Substituir o arco completo pelo arco parcial: ponto inicial `(cx - radius, cy)`, ponto final calculado a partir de `angleRad` (`endX = cx + radius * cos(angleRad)`, `endY = cy - radius * sin(angleRad)`), flags `0 0 1` (varredura máxima de 180°, então large-arc = 0).
- Manter o `linearGradient` atual sem alteração — o degradê continua mapeado na largura total, então a cor na ponta corresponde à posição do valor na escala.
- Caso `value` = 0, o arco parcial tem comprimento zero; renderizar o path normalmente (invisível) é suficiente.
- `OfficeGauge`, `DepartmentGauge`, textos e rotações da agulha permanecem intactos.

Sem alterações em dados, cálculos, consultas ou demais componentes.
