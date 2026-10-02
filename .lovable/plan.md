# Cartões e gráfico da Pessoal iguais à imagem

## Cartões (os 4 do topo)
- Mesmo layout da imagem: ícone num quadrado arredondado colorido, título com seta ">" no canto e número grande.
- Em "Experiências a vencer" e "Férias a vencer", o prazo vira uma etiqueta ao lado do título ("15 dias", "60 dias").
- Linha "↑ +7,6% vs. mês anterior" em verde ou vermelho:
  - **Funcionários ativos** e **Total de salários**: usa a variação real entre os dois últimos meses da Folha.
  - **Experiências** e **Férias**: o sistema não guarda histórico mês a mês desses números, então essa linha não aparece para não mostrar um número inventado.
- Rodapé: "79 empresas" e "20 desligados" com ícones no primeiro cartão. Nos demais, o texto de apoio que já existe ("Folha dos 299 funcionários", "41 prazo(s) já vencidos" etc.).
- Mini gráfico de barras colorido no canto, na cor de cada cartão. Nos dois primeiros, ele usa os últimos meses da Folha.
- Clicar no cartão continua abrindo as listas, como hoje.

## Gráfico "Evolução de funcionários e salários"
- Cabeçalho com ícone azul, título e subtítulo.
- À direita, o seletor **Mensal / Trimestral / Anual**, que agrupa os meses. Funcionários = média do período, salários = soma.
- Também à direita, o seletor de período ("jan/26 – ago/26"), com mês inicial e final.
- Caixas de marcar **Funcionários** (laranja) e **Salários (R$)** (verde) para mostrar ou esconder cada série.
- Barras laranja com degradê e número em negrito em cima de cada uma.
- Linha verde com pontos brancos de borda verde, área verde clara embaixo e o valor em etiqueta verde clara ("R$ 774,2 mil").
- Eixos com título ("Funcionários" à esquerda, "Salários" à direita, em verde), valores em "R$ 250 mil" e legenda centralizada embaixo.

## Detalhes técnicos
- `src/components/personnel/PersonnelEvolutionChart.tsx`: reescrever com `ComposedChart` (`Bar` com `linearGradient`, `Area` + `Line`, `LabelList` com conteúdo customizado em SVG para as etiquetas), estado `granularity` e `range` e `Checkbox` do shadcn. Exportar um hook `usePayrollMonthly(clientIds)` para os cartões calcularem as variações e os mini gráficos.
- `src/pages/Personnel.tsx`: refazer só o bloco dos 4 cartões.
- Cores por tokens: `primary` (laranja), `success`, `destructive`, `warning`, além de um token de azul para o ícone do gráfico, adicionado em `index.css` se não existir.
- Não muda nada no banco de dados. Depois da mudança, rodar `bunx tsgo` e conferir a tela por captura.
