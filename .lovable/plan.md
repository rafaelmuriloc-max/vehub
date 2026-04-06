

# Corrigir contagem de concluídas na lista do mês

## Problema
A lista de obrigações do mês (`monthEvents`, linha 258) filtra apenas eventos com `type === 'target'`. Após a correção de deduplicação, quando a data da meta e do vencimento caem no mesmo dia, o evento é mantido como `type: 'due'` (maior prioridade). Esses eventos são excluídos da lista do mês, causando divergência entre o número nos cards (que conta corretamente a partir das instâncias) e a lista exibida.

## Solução
Alterar o filtro de `monthEvents` para não restringir por tipo. Como a deduplicação já garante um único evento por instância por dia, basta agrupar por `instanceId` e manter um evento por instância (o de maior prioridade):

```typescript
const monthEvents = useMemo(() => {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const monthFiltered = events.filter(e => e.date.startsWith(prefix));
  // Keep one event per instance (highest priority already from dedup)
  const byInstance = new Map<string, CalendarEvent>();
  const priority: Record<string, number> = { due: 3, target: 2, alert: 1 };
  for (const ev of monthFiltered) {
    const existing = byInstance.get(ev.instanceId);
    if (!existing || (priority[ev.type] ?? 0) > (priority[existing.type] ?? 0)) {
      byInstance.set(ev.instanceId, ev);
    }
  }
  return Array.from(byInstance.values()).sort((a, b) => a.date.localeCompare(b.date));
}, [events, year, month]);
```

Isso garante que cada instância aparece exatamente uma vez na lista do mês, independente do tipo do evento, alinhando a contagem da lista com os cards de métricas.

## Arquivo
- `src/pages/CalendarView.tsx` — ~10 linhas alteradas no `useMemo` de `monthEvents`

