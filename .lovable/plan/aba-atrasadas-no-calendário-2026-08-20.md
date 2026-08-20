# Aba "Atrasadas" no calendário

## O que muda

Nova aba **Atrasadas** listando obrigações **ainda não concluídas cujo vencimento já passou** (vencimento < hoje). Não confundir com a aba já existente "Fora do prazo", que mostra obrigações já concluídas depois do prazo.

A aba aparece em dois lugares:
1. Lista do dia selecionado ("A Fazer" / "Concluído" / **Atrasadas**).
2. Lista mensal ("A fazer" / "Concluídas" / **Atrasadas** / "Fora do prazo" / "Aguardando" / "Excluídas" / "Suspensos"), posicionada logo após "A fazer".

Comportamento:
- Critério: obrigação não concluída, não suspensa, não em "Aguardando", com data de vencimento estritamente anterior a hoje (vencer hoje não é atraso).
- Ordenação da mais antiga para a mais recente.
- Contador no rótulo da aba, igual às demais.
- Cards com destaque de alerta (borda/fundo vermelho) e badge com os dias de atraso.
- Mesma paginação, seleção múltipla e ações em lote das outras abas.
- Se não houver atrasadas, a aba mostra "Nenhuma obrigação atrasada".

## Detalhes técnicos

Arquivo único: `src/pages/CalendarView.tsx`.

- Novo helper `isOverdueEvent(ev)`: usa a mesma resolução de vencimento já empregada em `isInstanceLateDelivery` (due_date da instância ou `due_day` da obrigação) e compara com `todayStr` via `>`.
- Novos derivados: `dayEventsOverdue` (a partir de `selectedEvents`) e `monthEventsOverdue` (a partir de `monthEvents`), ambos excluindo concluídas, suspensas e `onHoldIds`.
- Novos estados de página `dayOverduePage` / `monthOverduePage` + `paginatedDayOverdue` / `paginatedMonthOverdue` e respectivos `totalPages`, seguindo o padrão atual.
- Adicionar `<ObligationTab value="overdue" ...>` nos dois `TabsList` e a entrada correspondente no array de tabs do dia / novo `TabsContent` no bloco mensal, reutilizando o mesmo markup de card das abas existentes.
- Sem alterações de banco de dados ou edge functions.
