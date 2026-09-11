# Deixar o sistema mais rápido

## O que foi verificado agora

- Neste momento o banco não está respondendo às consultas de diagnóstico ("connection pooler unavailable") — parte da lentidão de agora é o próprio banco acordando/sobrecarregado. Primeiro passo do trabalho é reconfirmar isso quando o banco voltar.
- A consulta mais cara do sistema é a contagem de obrigações do mês: 115.196 chamadas, média de 123 ms, ~14.000 segundos de banco acumulados. Sozinha, ela responde pela maior parte do tempo de banco.
- As outras duas mais pesadas também são de obrigações do mês (99.806 e 61.264 chamadas).
- A tabela de obrigações tem apenas 5.880 linhas (4.932 ativas). Um volume tão pequeno não deveria levar 123 ms — o custo vem do número de chamadas e das consultas trazerem dados demais.
- Existe só um índice útil nessa tabela (por mês de referência). Não há índice por data de vencimento nem por situação.
- Vários painéis do Dashboard se atualizam sozinhos a cada 15/30 segundos, cada um disparando várias contagens: Obrigações, Tarefas (6 contagens), Clientes (5 contagens) e Chamados.
- A tela do Calendário recarrega, a cada mudança, a lista inteira de obrigações do mês, mais todas as obrigações, todos os clientes, todos os departamentos, todas as atividades e as tarefas do mês.
- Na importação de documentos, cada obrigação é verificada com consultas uma a uma dentro de laços (efeito "N+1"), o que deixa a importação lenta quando há vários documentos.

## O que será feito

1. **Reduzir a repetição automática**
   Espaçar as atualizações automáticas do Dashboard (de 15/30 s para 60 s) e pausá-las quando a aba não está em foco. Isso corta a maior parte das 115 mil chamadas sem mudar nada do que aparece na tela.

2. **Agrupar as contagens do Dashboard**
   Trocar os blocos de 5 e 6 contagens separadas (Clientes e Tarefas) por uma única consulta que traz os números já somados. Menos idas ao banco, mesmo resultado.

3. **Criar índices na tabela de obrigações**
   Índices por data de vencimento e por situação (considerando apenas registros não excluídos), além do índice de mês já existente. Isso derruba o tempo médio das três consultas mais pesadas.

4. **Aproveitar cache entre telas**
   Colocar as listas fixas (obrigações cadastradas, clientes, departamentos, atividades) em cache compartilhado, para o Calendário não rebaixá-las do banco a cada troca de mês ou filtro. Só as instâncias do mês continuam sendo buscadas.

5. **Corrigir o "N+1" da importação de documentos**
   Buscar atividades e conclusões de todas as obrigações envolvidas de uma vez, em vez de uma consulta por obrigação dentro do laço.

6. **Medir de novo**
   Depois das mudanças, reexecutar o ranking de consultas lentas e comparar chamadas/tempo médio, para confirmar o ganho.

## Detalhes técnicos

- Índices (migration): `obligation_instances (due_date) WHERE deleted_at IS NULL`, `obligation_instances (status, reference_month) WHERE deleted_at IS NULL`, `obligation_instances (client_id, reference_month)`.
- Dashboard: `refetchInterval` 60 s + `refetchIntervalInBackground: false` em `ObligationsPanel`, `TasksPanel`, `ClientsPanel`, `TicketsPanel`; contagens agrupadas via RPC `dashboard_counts()` (security definer, stable).
- `CalendarView.tsx`: mover `obligations`, `clients`, `departments`, `obligation_activities` para `useQuery` com `staleTime` alto (já há defaults de 5 min no `QueryClient`); manter `loadData()` só para as instâncias e tarefas do mês.
- `Documents.tsx`: substituir `isInstanceFullyCompleted` por pré-carregamento em lote (`.in('obligation_id', ids)` e `.in('instance_id', ids)`).
- Sem mudanças de RLS, de permissões ou de layout.
