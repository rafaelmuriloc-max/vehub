# Ponteiro dos medidores igual à imagem

## O que muda
Apenas a agulha dos gráficos de desempenho (geral e por departamento). Arco, cores, percentuais e textos permanecem como estão.

Na referência, o ponteiro é:
- Uma agulha curta e preta, grossa junto ao centro e afinando até uma ponta fina que encosta na parte interna do arco colorido.
- Um círculo preto sólido no eixo, maior que o atual, formando o cubo da agulha.
- Ponta levemente arredondada, sem contorno claro.

## Detalhes técnicos
No componente `GaugeArc` em `src/pages/CalendarView.tsx`:
- Substituir o `polygon` atual (que vai do topo do SVG até a base, atravessando todo o raio) por uma agulha mais curta: base larga próxima ao eixo (80,78) e ponta afinada terminando pouco antes do raio interno do arco.
- Usar `strokeLinejoin="round"` e preenchimento sólido escuro (`fill-foreground`) para a ponta suave.
- Aumentar o raio do círculo central para cerca de `strokeWidth / 1.8`, mantendo-o desenhado depois da agulha.
- Manter a rotação por `angle` já calculada, para que a posição continue correta para qualquer percentual.
- As proporções são relativas ao `strokeWidth`, então os medidores departamentais menores e o medidor geral maior ficam visualmente consistentes.

Sem alterações de dados, cálculos, backend ou layout dos cards.
