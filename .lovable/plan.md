# Filtro de obrigações entregues fora do prazo no calendário

## Objetivo
Permitir visualizar no calendário quais obrigações foram concluídas, mas somente após o vencimento. O filtro deve estar disponível tanto como toggle no topo da página quanto como uma aba dedicada na lista mensal.

## Critério de "fora do prazo"
Uma obrigação é considerada entregue fora do prazo quando a data/hora da última atividade concluída (`completed_at` mais recente de `obligation_activity_completions`) for posterior à data de vencimento da instância (`obligation_instances.due_date`, ou `obligations.due_day` aplicado à competência quando `due_date` for nulo).

## Mudanças no frontend

### 1. Estado e helpers em `src/pages/CalendarView.tsx`
- Adicionar estado `filterLateDeliveries: boolean` (default `false`).
- Criar função `isInstanceLateDelivery(instanceId: string, obligationId: string)`:
  - Retorna `false` se a instância não estiver concluída.
  - Obtém `completedAt` via `getInstanceCompletedAt`.
  - Obtém `dueDate` da instância ou da obrigação.
  - Compara apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone.
  - Retorna `true` se `completedAtDate > dueDate`.
- Criar função auxiliar `getInstanceDueDate(instanceId: string)` para centralizar a lógica de vencimento já existente.

### 2. Filtro no topo
- Adicionar um quarto controle ao lado dos filtros existentes (departamento, empresa, obrigação):
  - Um `Switch` ou `Toggle` com label "Fora do prazo".
  - Quando ativo, o calendário e as listas passam a exibir apenas obrigações concluídas fora do prazo.
- Incluir `filterLateDeliveries` no contador de filtros ativos do botão "Limpar filtros".
- Ao limpar filtros, resetar `filterLateDeliveries` para `false`.

### 3. Aplicação do filtro
- Aplicar `filterLateDeliveries` em:
  - `events` (dias do calendário).
  - `selectedEvents` (lista do dia selecionado).
  - `monthEvents` (lista mensal).
  - `deletedMonthEvents` e `monthEventsSuspended` (opcional, se fizer sentido mostrar excluídas/suspensas fora do prazo).
- Quando ativo, esconder obrigações pendentes, concluídas no prazo, excluídas e suspensas que não se encaixem no critério.

### 4. Nova aba "Fora do prazo" na lista mensal
- Adicionar aba "Fora do prazo" ao `TabsList` de "Obrigações de {mês}", entre "Concluídas" e "Excluídas".
- O conteúdo lista apenas `monthEventsCompleted` filtrados por `isInstanceLateDelivery`.
- Ordenar por data de vencimento (mais antigas primeiro).
- Reutilizar a paginação existente (`PaginationBlock`).

### 5. Destaque visual
- Cards de obrigações fora do prazo devem usar estilo de alerta (borda e fundo vermelho/laranja), diferente do verde padrão de concluídas.
- Exibir badge "Fora do prazo" e o número de dias de atraso (ex.: "3 dias de atraso").
- Manter a informação de "Concluído em {data/hora}" já existente.

### 6. Métricas do topo
- Ajustar o card "Concluídas" para que o subtexto "X fora" seja calculado com base na data real de conclusão vs. vencimento, não apenas com `today > dueDate`.

## O que não muda
- Nenhuma alteração de banco de dados é necessária; `obligation_instances.due_date`, `obligations.due_day` e `obligation_activity_completions.completed_at` já existem.
- Nenhuma alteração em Edge Functions.

## Validação
- Verificar no preview que:
  - O toggle aparece no topo.
  - Ao ativá-lo, o calendário mostra apenas obrigações concluídas fora do prazo.
  - A aba "Fora do prazo" lista corretamente as instâncias.
  - O destaque visual e o cálculo de dias de atraso estão corretos.
  - O botão "Limpar filtros" reseta o novo filtro.
