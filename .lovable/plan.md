# Painel de desempenho geral igual à referência

Ajustar apenas a aparência do bloco superior do calendário (`src/pages/CalendarView.tsx`), sem mexer em cálculos, filtros, calendário ou dados.

## O que muda

1. **Card do desempenho geral maior que os outros**
   - O card ocupa o mesmo lugar (coluna da direita, na mesma linha dos quatro indicadores), mas passa a ser visivelmente mais alto que os quatro cards de números, como na imagem: o bloco dos quatro cards fica alinhado ao topo e o card do gráfico se estende um pouco acima e abaixo deles.
   - Título "Desempenho geral da operação" com ícone laranja no topo à esquerda e subtítulo "Visão consolidada de todos os departamentos" logo abaixo.

2. **Cores do gráfico iguais às da referência**
   - O arco deixa de ser laranja sólido e passa a usar a mesma faixa colorida contínua dos medidores por departamento: vermelho → laranja → amarelo → verde, com degradê suave (gradiente SVG), pontas arredondadas e trilho cinza claro por baixo.
   - O mesmo degradê contínuo é aplicado também aos cinco medidores dos departamentos, para ficarem idênticos ao modelo (hoje eles usam três blocos de cor separados).

3. **Ponteiro igual ao da referência**
   - Ponteiro em formato de agulha preta, mais grossa na base e afinando na ponta, com um círculo preto no centro do arco.
   - O ponteiro fica sobre o arco, apontando o percentual atual.

4. **Percentual e comparação**
   - Percentual grande e escuro no centro do arco.
   - Abaixo, "▲ +5% vs. mês anterior" em verde (ou vermelho quando negativo), no formato da imagem.

## Detalhes técnicos

- Um único componente de medidor reutilizável com `<defs><linearGradient>` (stops: vermelho, laranja, amarelo, verde) aplicado ao `stroke` do arco; tamanho parametrizado (`size`) para o medidor do escritório ser maior que os departamentais.
- Ponteiro como `<polygon>` afilado, rotacionado por `value * 1.8 - 90` em torno do centro, mais `<circle>` central.
- Cores vindas dos tokens já existentes em `index.css` (`calendar-red`, `calendar-orange`, `calendar-green`) mais um token amarelo, se necessário.
- Grid mantém `xl:grid-cols-3` (KPIs em 2 colunas, gráfico em 1); a diferença de altura vem de `items-start` nos KPIs e altura mínima maior no card do gráfico. Em telas menores tudo empilha.
