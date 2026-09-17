# Cards de indicadores do calendário em cor sólida

O usuário escolheu a direção "Sólido compacto": cada um dos quatro cards (**A fazer**, **Atrasadas**, **Concluídas**, **Fora do prazo**) passa a ter fundo integral na cor do indicador, com texto branco — em vez do fundo suave atual.

## Mudanças visuais (bloco dos quatro cards, `src/pages/CalendarView.tsx` ~linhas 1278-1306)

- Fundo do card: cor sólida do indicador — azul (`calendar-blue`), vermelho (`calendar-red`), verde (`calendar-green`) e cinza escuro para "Fora do prazo" — sem borda, com sombra suave colorida.
- Ícone em quadrado translúcido branco (`bg-white/20`, cantos arredondados), ícone branco — substitui o quadrado colorido atual.
- Título pequeno em maiúsculas em tom claro da cor (`cor-100`), alinhado à direita do topo, com o número grande em branco abaixo dele (layout compacto do protótipo escolhido: ícone à esquerda, título + número à direita).
- Texto de detalhe em tom claro da cor, abaixo do bloco superior.
- Barra de progresso na base: trilho translúcido branco, preenchimento branco; percentual em branco/negrito ao lado (quando aplicável).
- Manter a regra atual de exibição do percentual: aparece em "A fazer" e "Concluídas"; não aparece em "Atrasadas" nem "Fora do prazo".
- No modo escuro, usar as mesmas cores sólidas (tokens já possuem variantes dark); texto continua branco.

## Preservado

- Valores, cálculos, filtros, KPIs e o card "Desempenho geral da operação" ao lado — nada muda além do estilo dos quatro cards.
- Dimensões/grade atuais (quatro colunas ao lado do painel de desempenho).
- Responsividade atual (empilhamento em telas menores).

## Validação

- Conferir os quatro cards em desktop e no modo escuro, comparando com o protótipo escolhido.
- Validar que listas, gráficos e demais áreas do calendário seguem intactos; typecheck e build sem erros.
