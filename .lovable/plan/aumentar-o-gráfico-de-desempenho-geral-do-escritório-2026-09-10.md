# Aumentar o gráfico de desempenho geral do escritório

## Objetivo
Aumentar visualmente o medidor semicircular de "Desempenho geral do escritório" na tela do calendário, sem alterar cálculos, dados ou backend.

## Escopo
- Alterar apenas o componente `OfficeGauge` e o card que o envolve em `src/pages/CalendarView.tsx`.
- Preservar os quatro KPIs à esquerda, o painel departamental abaixo, filtros, calendário e listas.

## Mudanças
1. **Aumentar o medidor `OfficeGauge`**
   - Aumentar dimensões do SVG/container (ex.: de `h-[74px] w-[132px]` para ~`h-[120px] w-[220px]`).
   - Aumentar espessura do arco, tamanho do ponteiro e fonte do percentual proporcionalmente.
   - Manter o texto "vs. mês anterior" e a variação em p.p.

2. **Aumentar o card do gráfico**
   - No desktop, manter o card ao lado dos quatro KPIs, mas permitir mais altura para acomodar o medidor maior.
   - Ajustar padding e centralização para o gráfico não ficar encolhido.

3. **Responsividade**
   - Em telas pequenas, o card continua empilhando abaixo dos KPIs, e o medidor reduz para um tamanho intermediário (ex.: `h-[90px] w-[170px]`) para não quebrar a largura.

4. **Validação**
   - Rodar `bunx tsgo --noEmit -p tsconfig.app.json`.
   - Verificar build e `git diff --check`.
