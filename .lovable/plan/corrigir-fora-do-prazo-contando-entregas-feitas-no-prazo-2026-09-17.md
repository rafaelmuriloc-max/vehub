# Corrigir "Fora do prazo" contando entregas feitas no prazo

## O problema confirmado

O sistema compara a data de conclusão usando o **horário de Londres (UTC)**, não o de Brasília. Uma obrigação concluída às 21h30 do dia 10 (data de vencimento) já é registrada como "11" no fuso UTC — e por isso aparece como entregue fora do prazo. Isso explica os 65 itens do card.

O mesmo desvio de fuso afeta a data de "hoje" usada nos cartões, então depois das 21h as contagens de "Atrasadas" e "Vence hoje" também podem virar um dia antes da hora.

## O que será feito

1. Criar uma regra única de "data no fuso de Brasília" usada em todo o sistema, tanto para converter o momento da conclusão quanto para saber qual é o dia de hoje.
2. Aplicar essa regra nas comparações de prazo:
   - cartões e gráficos do calendário (Fora do prazo, Concluídas, Atrasadas, Vence hoje, desempenho geral e por setor);
   - os mesmos cartões e gráficos replicados no dashboard;
   - o destaque verde de "concluída antes do prazo" nos cartões de tarefas;
   - o filtro de "entregas fora do prazo" na lista de obrigações.
3. Conferir na lista quantos itens continuam realmente fora do prazo depois do ajuste, para validar que o número caiu do jeito esperado.

Nenhuma alteração de banco de dados, de dados gravados ou de regras de vencimento — apenas a forma de interpretar o horário na hora de comparar.

## Detalhes técnicos

- Novo helper em `src/lib/utils.ts`: `localDateKey(value?: string | Date): string` retornando `yyyy-MM-dd` em `America/Sao_Paulo` (via `Intl.DateTimeFormat` com `timeZone`), mais `todayKey()`.
- `src/pages/CalendarView.tsx`: `isInstanceLateDelivery` troca `completedAt.split('T')[0]` por `localDateKey(completedAt)`; `const today = new Date().toISOString().split('T')[0]` passa a `todayKey()`; demais usos de `parseISO(completedAt...)` alinhados ao mesmo critério.
- `src/components/performance/OperationPerformance.tsx`: `isLateDelivery` usa `localDateKey(done)`; `format(new Date(), 'yyyy-MM-dd')` mantém comportamento local (já correto) mas passa a usar o mesmo helper para consistência.
- `src/pages/Tasks.tsx`: `isCompletedOnTime` usa `localDateKey(task.completed_at)`; `today` via `todayKey()`.
- Validação: `bunx tsgo --noEmit`, `bun run build` e consulta somente leitura contando conclusões cuja diferença UTC/BRT muda o resultado.
