

# Destacar Obrigações Concluídas (Linha Verde)

## Objetivo
Quando todas as atividades de uma instância de obrigação estiverem concluídas, a obrigação deve ser visualmente marcada como concluída com destaque verde na linha inteira. Isso se aplica à tabela na aba de obrigações do cliente e à lista do calendário.

## Mudanças

### 1. `src/components/ClientObligationsTab.tsx`

- **Helper `isInstanceCompleted(inst)`**: Verifica se todas as atividades da obrigação possuem completion `completed: true`. Se não há atividades, não é considerado concluído.
- **Destaque verde na linha**: No `TableRow` de cada obrigação, para cada mês com instância, se `isInstanceCompleted` retorna true, aplicar `bg-green-100` na célula e trocar o ícone Check para um estilo mais destacado (ex: `text-green-700 font-bold`).
- **Linha inteira verde**: Se TODAS as instâncias daquela obrigação (em todos os meses exibidos) estão concluídas, aplicar `bg-green-50` no `TableRow` inteiro.

### 2. `src/pages/CalendarView.tsx`

- **Mesmo helper**: Calcular se a instância está concluída (todas as atividades completadas).
- **Na tabela do dia selecionado**: Aplicar `bg-green-100` no `TableRow` se a instância está concluída.
- **Badge "Concluída"**: Adicionar badge verde quando concluída.

### Detalhes técnicos

```typescript
// Helper function (same in both files)
function isInstanceCompleted(instanceId: string, obligationId: string): boolean {
  const oblActivities = activities.filter(a => a.obligation_id === obligationId);
  if (oblActivities.length === 0) return false;
  return oblActivities.every(act => {
    const comp = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
    return comp?.completed === true;
  });
}
```

- No ClientObligationsTab: `<TableRow className={allMonthsCompleted ? 'bg-green-50' : ''}>` e cada célula de mês com instância concluída recebe `bg-green-100`
- No CalendarView: `<TableRow className={completed ? 'bg-green-100' : ''}>` na lista diária

