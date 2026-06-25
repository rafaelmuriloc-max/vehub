## Mostrar data/hora de conclusão nos cards de obrigação

Adicionar a data e hora de conclusão nos cards de obrigações concluídas, tanto no painel lateral do dia selecionado quanto na lista mensal de "Concluído".

### Como calcular
A tabela `obligation_activity_completions` já possui `completed_at`. Vou:
1. Incluir `completed_at` no SELECT de completions em `loadData()` (`src/pages/CalendarView.tsx`).
2. Criar helper `getInstanceCompletedAt(instanceId)` que retorna o `MAX(completed_at)` entre as completions concluídas daquela instância.
3. Renderizar nos cards concluídos (tanto na aba "Concluído" do dia quanto na lista mensal) uma linha pequena com ícone de relógio: `Concluído em 25/06/2026 14:32`.

### Onde renderizar
- Card do dia (linha ~1144, dentro do bloco "completed"): adicionar abaixo da Progress, condicional a `completed && completedAt`.
- Card mensal "Concluído" (na lista `paginatedMonthCompleted`): mesmo tratamento.

Formato: `format(parseISO(completedAt), "dd/MM/yyyy 'às' HH:mm")` com `<Clock className="h-3 w-3" />`.

### Arquivos
- `src/pages/CalendarView.tsx` (única alteração)
