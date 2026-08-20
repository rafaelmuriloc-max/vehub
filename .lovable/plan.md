# Corrigir contagem de "Atrasadas" no calendário

## O que os dados mostram

No mês atual há 198 obrigações pendentes que o card "Atrasadas" está somando: **71 realmente vencidas** (vencimento anterior a hoje) e **127 que vencem hoje (20/08)**. A regra atual trata o próprio dia do vencimento como atraso.

## Correção

1. Uma obrigação só é considerada **atrasada** quando o vencimento já passou (vencimento anterior a hoje). Vencendo hoje, ela continua em "A Fazer".
2. O card "Atrasadas" passa a exibir o número real (71 no exemplo) e o subtexto mostra quantas vencem hoje, para não perder a visão de urgência (ex.: "127 vencem hoje").

## Detalhes técnicos

- `src/pages/CalendarView.tsx`, bloco dos cards de métricas (~linha 1031): trocar `todayStr >= dueDate` por `todayStr > dueDate` no cálculo de `overdue`; contar separadamente `dueToday` (`todayStr === dueDate`) e somá-lo a "A Fazer".
- Subtexto do card "Atrasadas": exibir `${dueToday} vencem hoje` quando houver, mantendo "Tudo em dia" quando não houver atrasadas nem vencimentos do dia.
- Nenhuma alteração de banco; as demais faixas (alerta/meta) e a lógica de "fora do prazo" das concluídas permanecem como estão.

## Validação

- Conferir no calendário que "Atrasadas" cai para as obrigações com vencimento anterior a hoje e que as do dia aparecem em "A Fazer" com o aviso de vencimento hoje.
