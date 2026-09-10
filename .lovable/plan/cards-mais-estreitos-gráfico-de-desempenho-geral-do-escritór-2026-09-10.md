# Cards mais estreitos + gráfico de desempenho geral do escritório ao lado

## O que muda

Na tela do Calendário, os quatro cards de indicadores (**A fazer**, **Atrasadas**, **Concluídas**, **Fora do prazo**) ficam mais estreitos e passam a dividir a mesma linha com um novo painel **Desempenho geral do escritório**:

```text
[ A fazer ][ Atrasadas ][ Concluídas ][ Fora do prazo ][ Desempenho geral do escritório ]
```

- Os quatro cards ocupam juntos cerca de 2/3 da largura, mantendo ícone, número, detalhe e barra de progresso, porém mais compactos (altura e espaçamentos reduzidos).
- O painel de desempenho ocupa o 1/3 restante, na mesma linha e com a mesma altura dos cards.

## Painel "Desempenho geral do escritório"

- Medidor semicircular (SVG) com o percentual de obrigações concluídas no período, usando o cálculo já existente (`dashboardStats.current.performance`).
- Percentual em destaque no centro e comparação com o mês anterior abaixo (ex.: "+5 p.p. vs mês anterior"), reaproveitando `dashboardStats.change`.
- Mesma identidade visual dos demais cards: cores do calendário, cantos discretos, tipografia atual.

## Comportamento responsivo

- Desktop: cards e painel na mesma linha.
- Telas menores: cards empilham em grade e o painel vai para baixo, sem sobreposição.

## Preservado

- Cálculos e números atuais dos indicadores e do desempenho.
- Painel "Desempenho geral dos departamentos" (cinco medidores), filtros, calendário, abas, listas e cronômetros permanecem como estão.
- Nenhuma alteração em banco de dados ou funções de servidor.

## Detalhes técnicos

- Edição apenas em `src/pages/CalendarView.tsx`: trocar a grade atual `xl:grid-cols-4` por um layout em duas colunas (`grid xl:grid-cols-3`: grade de cards em `xl:col-span-2` com `sm:grid-cols-2 xl:grid-cols-4`, e painel de desempenho na coluna restante).
- Medidor em SVG com arco de fundo e arco de progresso proporcional ao percentual.

## Validação

- Conferir alinhamento e mesma altura entre cards e painel no desktop.
- Verificar empilhamento no mobile.
- Typecheck e build sem erros.
