# Obrigações sumindo do calendário

## Causa confirmada

A tela do calendário busca as obrigações do mês em consultas que o Supabase corta
automaticamente em **1.000 linhas**. Conferindo o banco agora, o período carregado
(mês anterior + mês atual) tem:

- 1.563 obrigações por competência
- 1.333 obrigações por vencimento
- 2.714 registros de conclusão de atividades

Ou seja, tudo que passa de 1.000 é descartado silenciosamente — por isso várias
obrigações desapareceram do calendário e das listas, e os números dos cartões
também ficam menores do que o real. O mesmo acontece no painel de desempenho da
tela inicial, que carrega os dados da mesma forma.

## O que será feito

1. Carregar as obrigações do mês em blocos (páginas) até trazer tudo, em vez de
   parar nas primeiras 1.000 linhas.
2. Fazer o mesmo com as conclusões das atividades e com as tarefas do mês.
3. Aplicar a mesma correção no painel de desempenho da tela inicial, para os
   números continuarem batendo com o calendário.
4. Conferir depois da mudança que a quantidade de obrigações exibidas no mês
   corresponde à contagem do banco.

## Detalhes técnicos

- `src/pages/CalendarView.tsx` (`loadData`): usar paginação por `.range()` em loop
  (páginas de 1.000) para `obligation_instances` por `reference_month`, por
  `due_date`, para `tasks` e para o RPC `get_calendar_month_completions`
  (RPC também é limitado a 1.000 linhas; paginar via `.range()` sobre a chamada).
  Reaproveitar/estender o utilitário existente `src/lib/fetchInChunks.ts` ou criar
  um helper local `fetchAll(query)` que repete até a página vir incompleta.
- `src/components/performance/OperationPerformance.tsx`: mesmo tratamento nas seis
  consultas do `queryFn` (obrigações, instâncias por competência/vencimento,
  atividades, conclusões, clientes) — várias dessas tabelas também passam de 1.000
  linhas.
- Sem alterações de banco, RLS, migrations ou edge functions; nenhuma mudança de
  layout ou de regra de negócio.

## Validação

- Comparar a contagem de obrigações do mês na tela com a contagem no banco.
- Confirmar que os cartões (A fazer / Atrasadas / Concluídas / Fora do prazo)
  continuam batendo com as abas.
