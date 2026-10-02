# Tarefas em "Aguardando" não contam como atrasadas no Calendário

## O que muda
Tarefa com situação **Aguardando** passa a ter o prazo considerado como **hoje**, enquanto estiver nessa situação:
- Sai do cartão **Atrasadas** e entra em **A fazer** (vence hoje).
- Não aparece na lista "Tarefas vencidas ainda em aberto" nem com o selo vermelho "Atrasada".
- No calendário, aparece no dia de hoje (e não no dia do prazo antigo), mesmo que o prazo original seja de um mês anterior.
- O prazo gravado na tarefa não é alterado; quando sair de Aguardando, volta a valer o prazo original.

## Detalhes técnicos
- Em `src/pages/CalendarView.tsx`, criar `effectiveDue(t)` = `todayKey()` quando `t.status === 'in_progress'`, senão `t.due_date`.
- Usar `effectiveDue` em `isTaskOverdue`, no cálculo `taskStats` (cartões), em `monthTasksFor` e nas listas de tarefas do dia/mês.
- Obrigações em espera já são ignoradas no cálculo; sem alteração nelas.
