## Objetivo
Simplificar os 5 cards de resumo para 3 cards na página `/calendar`.

## Cards Finais
1. **A Fazer** — agrupa `todo` + `afterAlert` + `afterTarget` (tudo que ainda não está atrasado)
2. **Atrasadas** — mantém `overdue` (inalterado)
3. **Concluídas** — mantém `doneOnTime + doneLate` (inalterado)

## Mudanças
Arquivo: `src/pages/CalendarView.tsx` (bloco entre linhas 688–716)

1. **Agrupar contagens** — criar `toDoTotal = todo + afterAlert + afterTarget` para o primeiro card.
2. **Recriar o array `cards`** com 3 objetos em vez de 5:
   - Atualizar percentuais para que somem 100% com 3 categorias (`grandTotal = toDoTotal + overdue + doneTotal`).
   - Atualizar sub-legendas dinâmicas para o card "A Fazer".
   - Manter as paletas de cores dos 3 cards restantes (azul para A Fazer, vermelho para Atrasadas, verde para Concluídas).
3. **Ajustar o grid** para 3 colunas: `grid-cols-3 gap-4`.

## Fora do escopo
Nenhuma alteração de lógica de negócio, filtros, tabela ou outras seções da página.