

# Paginação de 5 itens na lista de obrigações do dia

## O que será feito
Alterar a paginação da lista de obrigações do dia selecionado de 10 para 5 itens por página. A paginação mensal (pendentes/concluídas) continuará com 10.

## Alteração em `src/pages/CalendarView.tsx`

1. **Criar constante separada** `DAY_ITEMS_PER_PAGE = 5` (linha ~50)
2. **Substituir** nas linhas ~397-398 o uso de `ITEMS_PER_PAGE` por `DAY_ITEMS_PER_PAGE` para `dayTotalPages` e `paginatedDayEvents`
3. **Atualizar** o `PaginationBlock` do dia (linha 669) para usar `DAY_ITEMS_PER_PAGE` no cálculo de start/end — ou passar o `perPage` como prop ao `PaginationBlock`

### Detalhe técnico
Adicionar prop `perPage` ao `PaginationBlock` (default `ITEMS_PER_PAGE`) para que o texto "Mostrando X-Y de Z" fique correto com 5 itens.

