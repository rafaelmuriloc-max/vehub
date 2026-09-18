# Parte não preenchida do medidor em cinza claro

Manter o arco colorido do início até a posição do ponteiro e re adicionar a trilha do restante do semicírculo em cinza claro. Percentuais, variação, ponteiro, tamanhos e demais elementos não mudam.

## O que muda visualmente

- O arco colorido (degradê vermelho → laranja → amarelo → verde) continua terminando exatamente na ponta da agulha, para qualquer percentual.
- A parte do arco além do ponteiro volta a existir, agora como trilha cinza clara (token `muted`), cobrindo o semicírculo completo (180°).
- O ponteiro, o número percentual, a variação "vs. mês anterior" e os cartões permanecem exatamente como estão.
- Vale para o medidor geral ("Desempenho geral da operação") e para os três departamentais, pois ambos usam o mesmo componente.

## Detalhes técnicos

Arquivo: `src/components/performance/gauges.tsx`, componente `GaugeArc`.

- Adicionar um `<path>` de trilha antes do arco colorido: `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}` (semicírculo completo), `fill="none"`, mesmo `strokeWidth` e `strokeLinecap="round"`, com `className="stroke-muted"`.
- O arco colorido parcial atual permanece desenhado por cima, da posição inicial até `endX/endY` calculados a partir de `angleRad`.
- Ordem no SVG: trilha cinza primeiro, arco colorido por cima (a trilha fica visível apenas além do ponteiro).
- `OfficeGauge`, `DepartmentGauge`, textos e rotações da agulha permanecem intactos.

Sem alterações em dados, cálculos, consultas ou demais componentes.
