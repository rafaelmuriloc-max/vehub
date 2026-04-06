

# Corrigir duplicação de obrigações quando Meta e Vencimento caem no mesmo dia

## Problema
Quando `target_day` e `due_day` de uma obrigação resultam na mesma data (após ajuste por dia útil), a lista do dia mostra duas entradas para a mesma obrigação/empresa — uma como "Meta" e outra como "Vencimento".

## Solução
Deduplicar os eventos por `instanceId` dentro de cada dia, mantendo apenas o tipo de maior prioridade: **Vencimento > Meta > Alerta**.

## Alteração em `src/pages/CalendarView.tsx`

Na construção do array `events` (useMemo, linhas ~200-206), após gerar os 3 eventos possíveis por instância, agrupar por `instanceId + date` e manter apenas o de maior prioridade:

```typescript
// Após o loop que gera result[]
const priority = { due: 3, target: 2, alert: 1 };
const deduped = new Map<string, CalendarEvent>();
for (const ev of result) {
  const key = `${ev.instanceId}-${ev.date}`;
  const existing = deduped.get(key);
  if (!existing || priority[ev.type] > priority[existing.type]) {
    deduped.set(key, ev);
  }
}
return Array.from(deduped.values());
```

Isso garante que cada obrigação aparece no máximo uma vez por dia, com o badge do tipo mais urgente.

## Arquivo
- `src/pages/CalendarView.tsx` — ~8 linhas alteradas no useMemo de `events`

