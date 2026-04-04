

# Melhorar paginação das obrigações no mobile

## Problema
No screenshot (viewport 402px), a paginação mostra "Previous", números, ellipsis e o último número — tudo horizontal, ocupando muito espaço e ficando apertado. O texto "Mostrando 1-10 de 48" também compete por espaço na mesma linha.

## Solução
Tornar o `PaginationBlock` compacto no mobile:

### Alterações em `src/pages/CalendarView.tsx` (~15 linhas)

1. **Layout empilhado no mobile**: O container muda de `flex items-center justify-between` para `flex flex-col items-center gap-2 md:flex-row md:justify-between`
2. **Ocultar "Previous"/"Next" texto no mobile**: Usar `<span className="hidden md:inline">` nos labels, mantendo apenas os ícones chevron
3. **Reduzir páginas visíveis no mobile**: Quando `totalPages > 3`, mostrar apenas página atual e adjacentes (sem primeira/última), economizando espaço
4. **Texto "Mostrando" menor**: `text-[10px] md:text-xs` para caber melhor
5. **Gap menor entre itens**: `gap-0.5 md:gap-1` no `PaginationContent`

O resultado será uma paginação compacta com apenas setas + 3 números no mobile, e o texto de contagem centralizado abaixo.

## Arquivo
- `src/pages/CalendarView.tsx` — apenas o componente `PaginationBlock` (linhas 53-94)

