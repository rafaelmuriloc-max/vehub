# Ajuste fino dos medidores de desempenho

Refinar apenas o desenho dos gauges na tela Calendário, mantendo cálculos, cores e o restante do layout.

## O que muda

- O número percentual passa a ficar alinhado à base do gráfico (na mesma linha da ponta do arco), centralizado.
- O ponteiro fica logo acima do número: agulha mais curta, partindo de um eixo posicionado acima da base, sem cruzar ou encobrir o texto.
- O círculo central do ponteiro acompanha essa nova posição.
- O mesmo padrão vale para o medidor grande (Desempenho geral da operação) e para os cinco medidores por departamento.

## Detalhes técnicos

Arquivo: `src/pages/CalendarView.tsx`, componente `GaugeArc`.

- Manter `cx/cy/radius` e o arco como estão.
- Texto do valor: `y` na base (aproximadamente `cy`, com `dominantBaseline="auto"`), centralizado horizontalmente.
- Ponteiro: reduzir `needleLen` (cerca de 0,45 do raio interno) e deslocar o eixo do ponteiro para cima da base (novo `pivotY = cy - alturaDoTexto`), recalculando ponta e círculo central a partir desse pivô, preservando a fórmula de rotação por valor.
- Ajustar levemente `valueFontSize` se necessário para o texto caber entre as pontas do arco.

Sem alterações em dados, consultas ou demais componentes da página.
