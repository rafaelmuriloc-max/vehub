## Contexto
O painel "Clientes" no Dashboard (`ClientsPanel.tsx`) exibe quatro métricas: Ativos, Inativos, Novos no mês e Churn no mês. A tabela `clients` possui um campo boolean `services_suspended` que indica clientes com serviços suspensos.

## Objetivo
Exibir a quantidade de clientes suspensos como subtexto (hint) dentro do card "Ativos".

## Implementação
1. Adicionar contagem de `services_suspended = true` à query do `ClientsPanel.tsx`, usando a mesma estratégia das demais contagens (`.select('id', { count: 'exact', head: true })`).
2. Incluir a prop `hint` no `MetricCard` de "Ativos", formatada como: "X suspensos".

## Arquivo alterado
- `src/components/dashboard/ClientsPanel.tsx`

## Detalhes técnicos
- A consulta será: `supabase.from('clients').select('id', { count: 'exact', head: true }).eq('services_suspended', true)`
- O hint será exibido abaixo do valor numérico do card, usando o estilo já existente do componente `MetricCard`.