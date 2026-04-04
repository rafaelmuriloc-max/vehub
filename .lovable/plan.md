

# Reduzir células do calendário no mobile — apenas dots, sem nomes

## Situação atual
O código já oculta nomes no mobile e mostra apenas dots coloridos (`md:hidden` / `hidden md:flex`). Porém, o `min-h-[48px]` ainda deixa as células grandes demais no viewport de 402px (cada célula fica ~50px de largura por 48px de altura).

## Alterações em `src/pages/CalendarView.tsx`

1. **Reduzir altura mínima das células no mobile**: `min-h-[32px]` em vez de `min-h-[48px]` (manter `md:min-h-[100px]`)
2. **Reduzir o badge do dia**: `w-5 h-5 text-[10px]` no mobile em vez de `w-6 h-6 text-xs`
3. **Reduzir padding das células**: `p-0.5 md:p-1.5`
4. **Dots menores**: `w-1 h-1` em vez de `w-1.5 h-1.5` no mobile, para caber melhor
5. **Células vazias (sem dia)**: mesma altura reduzida `min-h-[32px]`

Nenhuma lógica, estado ou funcionalidade alterada — apenas classes CSS de tamanho.

