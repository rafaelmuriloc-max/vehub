# Valor dos salários na base das colunas do gráfico

## O que muda
- No gráfico "Evolução de funcionários e salários" da Pessoal, o total de salários de cada mês passa a aparecer dentro da coluna, na parte de baixo, em letra branca e no formato curto (ex.: "R$ 774,2 mil").
- As etiquetas verdes com o valor, que hoje ficam sobre a linha, saem. A linha verde e a área clara continuam, só sem as etiquetas.
- A quantidade de funcionários continua em cima de cada coluna.
- Se a caixa "Salários (R$)" estiver desmarcada, o valor na base da coluna também some.

## Detalhes técnicos
- `src/components/personnel/PersonnelEvolutionChart.tsx`: dentro do `<Bar>`, adicionar um segundo `LabelList dataKey="salarios"` com conteúdo customizado em SVG que desenha o texto em `hsl(var(--primary-foreground))` (branco), centralizado na coluna, perto da base (`y + height - 10`). Ele só aparece quando `showSal` estiver ativo e a coluna tiver altura suficiente. Remover o `LabelList` com `SalaryPill` da `<Line>`.
