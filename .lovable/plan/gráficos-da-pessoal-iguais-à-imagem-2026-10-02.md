# Gráficos da Pessoal iguais à imagem

## O que muda
Os dois gráficos lado a lado ganham o visual da imagem. O cabeçalho geral, com o título, os seletores Mensal / Trimestral / Anual e o período, continua igual.

**Cartão Funcionários (esquerda)**
- Ícone de pessoas em um quadrado laranja claro, título "Funcionários" e a frase "Evolução do total de funcionários ativos."
- No canto direito, uma etiqueta laranja clara com a variação no período (ex.: "↑ +8,3% no período"), do primeiro ao último mês mostrado. Fica vermelha e com seta para baixo quando o número cair.
- Colunas laranja em degradê, forte no topo e quase transparente na base.
- A quantidade aparece em negrito numa etiqueta laranja clara em cima de cada coluna.
- O eixo não começa no zero, e sim um pouco abaixo do menor mês (ex.: 200 a 300), para destacar a diferença entre os meses, como na imagem.
- Grade pontilhada e legenda "Funcionários ativos" com bolinha laranja embaixo, à esquerda.

**Cartão Salários (direita)**
- Ícone de carteira em um quadrado verde claro, título "Salários (R$)" e a frase "Evolução do total da folha de pagamento."
- Etiqueta verde clara com a variação no período.
- Linha verde com pontos brancos de borda verde e área verde em degradê embaixo.
- O valor de cada mês aparece numa etiqueta verde clara acima do ponto (ex.: "R$ 774,2 mil").
- O eixo vai de R$ 0 a R$ 1.000 mil, em passos de R$ 250 mil.
- Legenda "Total da folha de pagamento (R$)" com bolinha verde embaixo, à esquerda.

**Mudança no valor dos salários:** o valor sai da base da coluna, em letra branca, e volta para as etiquetas verdes sobre a linha, como na imagem. Isso substitui o pedido anterior.

## Detalhes técnicos
- `src/components/personnel/PersonnelEvolutionChart.tsx`: criar um cabeçalho `ChartCard` reutilizável (ícone, título, subtítulo e etiqueta de variação), usado nos dois cartões.
- Funcionários: `BarChart` com `linearGradient` (primary 1 → 0.15), `LabelList` com conteúdo SVG próprio (`rect` com `primary/0.12` e texto em `primary`) e `YAxis domain=[floor(min*0.8/20)*20, ceil(max*1.1/20)*20]`.
- Salários: `ComposedChart` com `Area` em degradê `success` e `Line` com `dot` branco. A etiqueta da linha é uma pílula em `success/0.14`, com texto em `success`. O `YAxis` usa `tickFormatter` "R$ X mil" e um teto arredondado em múltiplos de 250 mil.
- A variação no período é calculada a partir de `data[0]` e `data[last]`.
- Só tokens semânticos (primary, success, destructive, muted).
