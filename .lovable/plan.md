

# Dividir obrigações do dia em abas "A Fazer" e "Concluído"

## O que será feito
Substituir a lista única de obrigações do dia selecionado por duas abas (Tabs), separando pendentes e concluídas — mesmo padrão já usado nas obrigações do mês.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Separar eventos do dia em pendentes/concluídos (após linha ~417)
```typescript
const dayEventsPending = selectedEvents.filter(ev => !isInstanceCompleted(ev.instanceId, ev.obligationId));
const dayEventsCompleted = selectedEvents.filter(ev => isInstanceCompleted(ev.instanceId, ev.obligationId));
```

### 2. Adicionar states de paginação por aba do dia
Novos states `dayPendingPage` e `dayCompletedPage` (substituindo `dayPage`), resetados ao mudar `selectedDay`.

### 3. Calcular paginação por aba
```typescript
const dayPendingTotalPages = Math.ceil(dayEventsPending.length / DAY_ITEMS_PER_PAGE);
const paginatedDayPending = dayEventsPending.slice(...);
const dayCompletedTotalPages = Math.ceil(dayEventsCompleted.length / DAY_ITEMS_PER_PAGE);
const paginatedDayCompleted = dayEventsCompleted.slice(...);
```

### 4. Substituir a lista direta por Tabs (linhas ~641-689)
Usar `<Tabs defaultValue="pending">` com:
- Aba "A Fazer" com badge de contagem `dayEventsPending.length` — renderiza `paginatedDayPending` + `PaginationBlock`
- Aba "Concluído" com badge de contagem `dayEventsCompleted.length` — renderiza `paginatedDayCompleted` + `PaginationBlock`

O card de cada obrigação permanece idêntico (já tem estilo verde para concluídas).

## Arquivo
- `src/pages/CalendarView.tsx`

