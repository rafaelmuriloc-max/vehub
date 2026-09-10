# Card "Desempenho geral da operação" igual à referência

Ajustar apenas o cartão de desempenho geral do calendário para reproduzir fielmente a imagem enviada. Nenhum cálculo, dado ou outra área da tela muda.

## O que muda visualmente

- Cartão branco, cantos levemente arredondados, borda cinza clara e leve sombra, com respiro interno maior.
- Cabeçalho alinhado à esquerda: ícone de barras laranja, título "Desempenho geral da operação" em azul-marinho negrito e subtítulo cinza "Visão consolidada de todos os departamentos".
- Medidor centralizado e mais largo, com arco espesso e pontas arredondadas no degradê vermelho → laranja → amarelo → verde, sobre trilha cinza clara.
- Ponteiro curto, preto, com miolo circular preto, posicionado acima do número e sem cobri-lo.
- Percentual grande em azul-marinho negrito, centralizado dentro do arco, alinhado à base.
- Logo abaixo do número, ainda dentro do arco: variação em verde com triângulo ("▲ +5%") seguida de "vs. mês anterior" em cinza.

## Detalhes técnicos

- Arquivo: `src/pages/CalendarView.tsx`, componentes `OfficeGauge` e `GaugeArc`.
- `GaugeArc` ganha suporte opcional para renderizar a linha de comparação dentro do SVG, abaixo do valor, mantendo a assinatura atual para os medidores departamentais.
- Ajustes de `viewBox`, raio, `strokeWidth`, posição do pivô e comprimento da agulha para o formato mais largo e achatado da referência.
- Card usa `rounded-md`, borda `border-border` e sombra suave; larguras responsivas para não quebrar em telas menores.
- Os medidores departamentais permanecem como estão.
