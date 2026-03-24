

# Reestruturar Layout do Calendário com Listas Lateral e Inferior + Paginação

## Objetivo
Mover a lista de obrigações do dia para o lado direito do calendário. Adicionar abaixo do calendário uma lista com todas as obrigações do mês. Ambas as listas com paginação.

## Mudanças

### Arquivo: `src/pages/CalendarView.tsx`

1. **Layout lado a lado**: Envolver calendário e lista do dia num `flex` row:
   - Esquerda (2/3): Card do calendário (grid mensal + legenda)
   - Direita (1/3): Card "Obrigações do dia DD/MM/YYYY" com tabela paginada (aparece sempre, mostra "Selecione um dia" se nenhum selecionado)

2. **Lista do mês abaixo**: Novo Card abaixo do flex row com todas as obrigações do mês corrente (todos os events filtrados), em tabela paginada com colunas: Dia, Empresa, Obrigação, Departamento, Tipo.

3. **Paginação**: Adicionar state `dayPage` e `monthPage` (default 1), com 10 itens por página. Usar componentes `Pagination` já existentes. Calcular `totalPages`, fatiar o array com `slice((page-1)*10, page*10)`.

4. **Computar `monthEvents`**: Todos os events cujo mês/ano correspondem ao `currentDate`, ordenados por data.

### Detalhes técnicos
- Import `Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext` de `@/components/ui/pagination`
- `dayPage` reseta ao mudar `selectedDay`; `monthPage` reseta ao mudar mês
- Layout responsivo: `flex-col lg:flex-row` para mobile vs desktop
- Manter dialog de detalhes inalterado
- Linhas verdes para instâncias concluídas mantidas em ambas as tabelas

