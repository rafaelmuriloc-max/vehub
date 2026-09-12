# Corrigir contagem "Atrasadas" no calendário

## O que os dados mostram

As 2 obrigações contadas como atrasadas são ISS (venc. 10/09) e Folha de Pagamento Mensal
(venc. 05/09), ambas da empresa **ELITE MONTAGEM DE ESTRUTURA METALICA LTDA**, que está com
**serviços suspensos**.

As listas do calendário excluem empresas suspensas (elas aparecem na aba "Suspensos") e
obrigações em "Aguardando". Já os cartões do topo não fazem essa exclusão — por isso o card
mostra 2 atrasadas sem nenhuma obrigação atrasada na lista.

## Correção

Os cartões do topo (A fazer, Atrasadas, Concluídas, Fora do prazo) e os medidores de
desempenho passam a usar exatamente o mesmo conjunto de obrigações das listas:

- ignorar obrigações de empresas com serviços suspensos;
- ignorar obrigações marcadas como "Aguardando".

Resultado: o card "Atrasadas" mostrará 0 nesse caso, e os percentuais de desempenho deixam de
considerar empresas suspensas.

## Detalhes técnicos

- `src/pages/CalendarView.tsx`, `dashboardStats`: no laço sobre `instances`, adicionar
  `if (onHoldIds.has(inst.id)) continue;` e o mesmo critério de suspensão usado por
  `isSuspendedEvent` (cliente com `services_suspended`), junto dos filtros já existentes.
  Incluir as dependências novas no `useMemo`.
- `src/components/performance/OperationPerformance.tsx`: aplicar as mesmas exclusões, para o
  painel do Dashboard refletir os mesmos números.
- Sem alterações de banco de dados, RLS ou edge functions.

## Validação

- Abrir o calendário no mês atual e confirmar "Atrasadas = 0", com as duas obrigações da
  empresa suspensa permanecendo na aba "Suspensos".
