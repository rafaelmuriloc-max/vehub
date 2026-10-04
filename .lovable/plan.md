# Corrigir vencimentos do portal do cliente

## O que foi encontrado
- O ISS de 09/10 existe para a empresa, mas a tarefa já está **concluída pelo escritório** (guia entregue). O portal hoje esconde vencimentos concluídos de "Próximos vencimentos" e do cartão — por isso ele sumiu. Para o cliente, a guia entregue ainda precisa ser paga.
- A competência mostrada vem do mês gravado na tarefa, que é o mesmo mês do vencimento (ex.: ISS de 09/10 aparece como "Competência 10/2026"). O correto é o mês anterior (09/2026).

## O que muda
1. Próximos vencimentos (lista e cartão) passam a mostrar todo imposto com vencimento de hoje até 30 dias, mesmo que o escritório já tenha concluído a tarefa. Quando concluída, aparece um selo discreto "Guia disponível".
2. A competência exibida passa a ser o mês anterior ao vencimento (ISS 09/10 → Competência 09/2026; DAS 20/10 → 09/2026; IRPJ/CSLL 30/10 → 09/2026). Vale para lista, calendário e detalhes.
3. Nada muda no sistema do escritório nem nos dados gravados.

## Detalhes técnicos
- `src/pages/Portal.tsx`: remover `!done` do filtro `upcoming`; calcular competência a partir de `due_date` menos 1 mês, ignorando `reference_month`.
- Nova função `competenciaFromDue(due)` em `src/lib/portalDashboard.ts` com testes (09/10/2026 → 09/2026; 20/01/2027 → 12/2026).
- `UpcomingDues` em `PortalWidgets.tsx`: selo "Guia disponível" quando `done`.
