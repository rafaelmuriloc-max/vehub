# Rótulos de valor no gráfico de evolução (Pessoal)

## O que muda
- Cada mês do gráfico passa a mostrar os números direto na tela, sem precisar passar o mouse:
  - a quantidade de funcionários aparece em cima de cada barra;
  - o total de salários aparece acima de cada ponto da linha, em formato curto (ex.: "R$ 1,2 mi").
- O gráfico fica um pouco mais alto para os números caberem sem se sobrepor.
- Ao passar o mouse, os valores exatos continuam aparecendo, como hoje.

## Detalhes técnicos
- `src/components/personnel/PersonnelEvolutionChart.tsx`: colocar `LabelList` do Recharts na `Bar` (posição `top`, número em pt-BR) e na `Line` (posição `top`, `brlCompact`), com fonte de 11px nas cores do tema.
- Aumentar a altura de `h-64` para `h-80` e a margem superior para 24px.
- Depois da mudança, rodar `bunx tsgo`.
