# Medidores de desempenho iguais à referência

Ajustar apenas a aparência dos medidores na tela do calendário (`src/pages/CalendarView.tsx`), sem tocar em cálculos, filtros ou dados.

## O que muda

- Arco mais largo e mais "achatado", ocupando toda a largura do card, como na imagem.
- Ponteiro menor: agulha curta partindo do centro, com o círculo preto no eixo.
- O número (ex.: 84%) passa a ficar dentro do arco, centralizado sob a curva, em vez de abaixo do gráfico.
- A comparação com o mês anterior (▲ +5% vs. mês anterior) continua logo abaixo do card.
- Os cinco medidores por departamento seguem exatamente o mesmo padrão, em escala menor.

## Detalhes técnicos

- Em `GaugeArc`: aumentar a proporção do viewBox (arco mais largo/baixo), reduzir o comprimento da agulha para cerca de 55% do raio e manter o cubo circular central.
- Passar o valor percentual como conteúdo interno do gauge, renderizado como texto SVG centralizado abaixo do eixo do arco.
- `OfficeGauge` e `DepartmentGauge` deixam de renderizar o percentual externo; ambos passam a usar o mesmo componente com tamanhos diferentes.
- Degradê vermelho → laranja → amarelo → verde e trilho claro permanecem como estão.
