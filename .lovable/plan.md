

# Reduzir largura do card e limitar páginas visíveis na paginação

## Problema
O card de obrigações do dia ocupa largura excessiva e a paginação mostra todas as páginas (ex: 13 páginas), ocupando muito espaço horizontal.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Limitar páginas visíveis na paginação
No `PaginationBlock`, em vez de renderizar todas as páginas, mostrar no máximo 5 páginas com ellipsis. Lógica: mostrar primeira, última e até 3 páginas ao redor da atual, com `PaginationEllipsis` entre gaps.

### 2. Limitar largura do card do dia
Adicionar `max-w-2xl` ao container do card de obrigações do dia selecionado para que não se estenda demais.

## Arquivo
- `src/pages/CalendarView.tsx`

