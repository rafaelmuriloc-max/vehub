# Efeito liquid glass nos gráficos de desempenho

## Objetivo

Deixar os medidores (geral e departamentos) com o visual "vidro líquido" da imagem de referência: arco colorido com brilho e aparência de vidro, trilha cinza translúcida, agulha azul-marinho arredondada com brilho, número grande azul-marinho e variação abaixo.

## O que muda em `src/components/performance/gauges.tsx`

1. **Trilha (parte não preenchida)**: cinza claro translúcido com aparência de vidro — cor `hsl(var(--muted))` com opacidade reduzida + leve sombra interna (filtro SVG) para efeito "frosted".
2. **Arco colorido**: mantém o preenchimento em degradê vermelho→laranja→amarelo→verde até a posição do ponteiro, com:
   - **Brilho superior**: segundo arco sobreposto mais fino, em branco translúcido (gradiente de opacidade), deslocado para a borda superior — o reflexo característico do vidro.
   - **Glow suave**: filtro `feGaussianBlur` colorido abaixo do arco, criando a auréola difusa da referência.
   - Pontas arredondadas (strokeLinecap round) preservadas.
3. **Agulha**: azul-marinho (`text-calendar-navy` / #102A56) com forma arredondada e leve brilho lateral, círculo central no pivô — substitui o preto chato atual por um tom com profundidade (gradiente radial sutil).
4. **Número e variação**: sem mudança de dados — percentual grande azul-marinho dentro do arco e "▲/▼ X% vs. mês anterior" abaixo, como já está.
5. **Escopo**: somente `GaugeArc` (usado por `OfficeGauge` e `DepartmentGauge`), então calendário e dashboard recebem o efeito automaticamente. Nenhum dado, cálculo ou layout de card muda.

## Verificação

- `bunx tsgo --noEmit` e `bun run build` sem erros.
- Conferência visual no calendário e no dashboard: arco com reflexo de vidro, trilha cinza translúcida, agulha navy, valores inalterados.
