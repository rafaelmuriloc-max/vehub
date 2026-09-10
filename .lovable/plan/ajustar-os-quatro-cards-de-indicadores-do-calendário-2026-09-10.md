# Ajustar os quatro cards de indicadores do calendário

Deixar os cards "A fazer", "Atrasadas", "Concluídas" e "Fora do prazo" exatamente com o visual da imagem de referência.

## Mudanças visuais

- Cantos mais arredondados nos cards e no quadrado do ícone.
- Quadrado do ícone com fundo sólido na cor do indicador (azul, vermelho, verde, cinza) e ícone branco, um pouco maior.
- Fundo do card em tom bem suave da mesma cor, com borda clara.
- Título colorido acima do número grande, à direita do ícone.
- Texto de detalhe em cinza logo abaixo, alinhado com o número.
- Barra de progresso na base ocupando a largura do card, com a porcentagem à direita na cor do indicador.
- No card cinza "Fora do prazo" a porcentagem não aparece, apenas a barra, como na referência.
- Espaçamento interno e alturas iguais entre os quatro cards.

## Detalhes técnicos

- Arquivo único: `src/pages/CalendarView.tsx`, bloco dos quatro cards (linhas ~1233-1260).
- Ajustar apenas classes de estilo e a estrutura interna do card; os valores, cálculos e a grade que divide espaço com o card de desempenho geral permanecem iguais.
- Cores continuam vindo dos tokens já existentes (`calendar-blue`, `calendar-red`, `calendar-green`, `muted`).
