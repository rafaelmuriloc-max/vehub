# Medidores dos departamentos no mesmo layout do card geral

Aplicar aos gráficos de Fiscal, Contábil e Pessoal o mesmo padrão visual já usado no card "Desempenho geral da operação". Nenhum cálculo ou dado muda.

## O que muda visualmente

- Cada departamento continua em seu cartão branco, agora com cantos levemente arredondados, borda cinza clara e leve sombra, igual ao card geral.
- Arco mais espesso e largo, com pontas arredondadas e o mesmo degradê vermelho → laranja → amarelo → verde sobre trilha cinza clara.
- Ponteiro curto preto com miolo circular, posicionado acima do número sem cobri-lo.
- Percentual grande em azul-marinho negrito centralizado dentro do arco.
- Logo abaixo do número, dentro do arco: variação em verde/vermelho com triângulo seguida de "vs. mês anterior" em cinza (hoje fica solta abaixo do gráfico).
- Nome do departamento em destaque acima do medidor, alinhado à esquerda, no mesmo estilo do título do card geral.

## Detalhes técnicos

- Arquivo: `src/pages/CalendarView.tsx`, componente `DepartmentGauge`.
- Reutiliza `GaugeArc` com as props já criadas para o card geral (`change`, `changeFontSize`, `pivotOffset`, `needleScale`), em escala proporcionalmente menor.
- Remove o parágrafo de variação externo, já que passa a ser renderizado dentro do SVG.
- Mantém a rolagem horizontal e as larguras mínimas atuais dos cartões departamentais.
