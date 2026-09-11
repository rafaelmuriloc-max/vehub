# Diagnóstico de lentidão — Supabase externo (somente leitura)

Nenhum arquivo, dado, índice, política ou configuração foi alterado. Todas as evidências abaixo vieram de consultas de diagnóstico executadas agora.

## 1. Conexão e horário

- `SELECT 1` respondeu em menos de 1 s: `ok = 1`, `server_time = 2026-09-11 02:53:54 UTC`.
- PostgreSQL 17.6 (aarch64). `statement_timeout` da sessão administrativa: 2 min.
- Conclusão: o erro anterior de "connection pooler unavailable" não se reproduz.

## 2. Atividade, esperas e transações longas

Agregado de `pg_stat_activity` (banco atual):

| estado | espera | conexões | consulta mais antiga |
|---|---|---|---|
| idle | Client / ClientRead | 29 | 13 dias (sessão ociosa, sem transação aberta) |
| active | Client / WalSenderWaitForWal | 1 | 16 h (replicação/realtime, normal) |
| active | — | 1 | 0 s (a própria consulta) |
| — | IO / DataFileRead | 1 | transação de ~1 min 33 s |

- Não há bloqueio (`lock`) em espera nem transação `idle in transaction` presa.
- As 29 conexões ociosas são o pool do PostgREST/pooler; `longest_xact` nulo confirma que não seguram transação.

## 3. Tabelas mais consultadas — tamanho, tuplas, vacuum

| tabela | linhas vivas | dead tuples | % morto | último autovacuum | autoanalyze | tamanho | seq scans | idx scans |
|---|---|---|---|---|---|---|---|---|
| chat_messages | 36.442 | 435 | 1,2% | 28/08 | 09/09 | 20 MB | 100 | 48.249.074 |
| chat_conversations | 437 | 108 | 24,7% | 10/09 20:21 | 10/09 21:19 | 600 kB | 1.408.778 | 5.477.067 |
| clients | 230 | 9 | 3,9% | 09/09 | 09/09 | 552 kB | 1.165.546 | 8.846.079 |
| tasks | 353 | 18 | 5,1% | 04/09 | 04/09 | 424 kB | 915.145 | 3.101 |
| obligation_instances | 5.880 | 96 | 1,6% | 04/09 | 04/09 | 1.472 kB | 100.814 | 500.357 |
| obligation_activity_completions | 7.537 | 1.466 | 19,5% | 24/08 | 11/09 01:27 | 2.272 kB | 334.885 | 21.693 |
| invoices | 12.110 | 1.136 | 9,4% | 09/09 | 09/09 | 82 MB | 50 | 25.696 |
| email_messages | 12.776 | 146 | 1,1% | 13/08 | 03/09 | 93 MB | 194 | 24.598 |
| sitfis_results | 206 | 58 | 28,2% | 09/09 | 09/09 | 20 MB | 4.043 | 4.692 |

Leitura dos números:
- Nenhuma tabela é grande em linhas. O banco inteiro cabe em cache; o problema **não é volume de dados**.
- O que chama atenção é o **número de execuções**: `clients` sofreu 1,16 milhão de varreduras sequenciais e 8,8 milhões de acessos por índice em uma tabela de 230 linhas. `chat_conversations`, com 437 linhas, teve 1,4 milhão de seq scans e 5,4 milhões de acessos por índice.
- Autovacuum/autoanalyze estão rodando; a maior sujeira relativa é `sitfis_results` (28%) e `chat_conversations` (25%), ambas irrelevantes pelo tamanho.

## 4. Índices e RLS das tabelas citadas

Índices existentes (relevantes):
- `obligation_instances`: pkey; `idx_obligation_instances_active (reference_month) WHERE deleted_at IS NULL`; `idx_obligation_instances_client_ref (client_id, reference_month)`; `idx_obligation_instances_due_active (due_date) WHERE deleted_at IS NULL`; `idx_obligation_instances_status_ref_active (status, reference_month) WHERE deleted_at IS NULL`.
- `obligation_activity_completions`: pkey; `idx_obligation_activity_completions_instance (instance_id)`; `..._retry (instance_id, activity_id) WHERE completed=false`; `..._unique_marker (instance_id, activity_id) WHERE file_url IS NULL`.
- `chat_messages`: `(conversation_id, created_at DESC)`, `(conversation_id, wa_evolution_id)`, `(wa_message_id)`, `(reply_to_id)`, parcial `idx_chat_messages_unread_incoming`.
- `chat_conversations`: pkey, `idx_chat_conversations_status_assigned_updated`, `idx_chat_conv_awaiting`, `whatsapp_phone`.
- `clients`, `tasks`, `task_assignments`: apenas chaves primárias/únicas — **nenhum índice secundário**.

Uso real dos índices criados recentemente (`pg_stat_user_indexes`):

| índice | scans | tuplas lidas |
|---|---|---|
| idx_obligation_instances_active | 430.806 | 631.100.877 |
| idx_obligation_instances_status_ref_active | 3 | 0 |
| idx_obligation_instances_due_active | 0 | 0 |
| idx_obligation_instances_client_ref | 6 | 9.348 |
| idx_obligation_activity_completions_instance | 112 | 2.606 |
| idx_chat_messages_unread_incoming | 6 | 102 |
| idx_chat_conversations_status_assigned_updated | 67 | 11 |
| idx_chat_messages_evo_id | 23.332.834 | 1.689.981.790 |

Fato importante: os índices criados na rodada anterior estão praticamente **sem uso** (0 a 112 scans), enquanto `idx_obligation_instances_active` lê em média ~1.465 tuplas por scan — ou seja, o caminho real de execução ainda varre o mês inteiro linha a linha.

RLS das tabelas pedidas:
- `clients`, `tasks`, `task_assignments`: SELECT com `USING (true)` — barato.
- `obligation_instances` SELECT: `EXISTS (SELECT 1 FROM obligations o WHERE o.id = obligation_id AND user_can_access_department(auth.uid(), o.department_id))`.
- `obligation_activity_completions` SELECT: `EXISTS (... obligation_activities JOIN obligations ... user_can_access_department(...))`.
- Funções auxiliares: `has_role` e `user_can_access_department` são `STABLE SECURITY DEFINER`; `user_can_access_department` faz até três subconsultas (`has_role`, existência em `profile_departments`, pertencimento) por avaliação.

## 5. Ranking de consultas (pg_stat_statements)

`pg_stat_statements` não é acessível pela conexão de leitura (`relation "pg_stat_statements" does not exist` — visibilidade do papel), então o ranking veio da ferramenta interna, que expõe `calls`, `mean_ms`, `max_ms` e `total_ms`, mas **não** `rows`, `shared_blks_*` nem `stats_reset`.

Top por tempo total:

| # | alvo (tela provável) | calls | mean ms | max ms | total ms |
|---|---|---|---|---|---|
| 1 | count obligation_instances por reference_month+status (painel Obrigações) | 115.196 | 123,41 | 1.747 | 14.216.000 |
| 2 | obligation_instances + obligation/department do mês (Calendário) | 99.806 | 21,24 | 6.678 | 2.120.313 |
| 3 | obligation_instances + client/obligation por due_date (Calendário/Dashboard) | 61.264 | 17,98 | 6.478 | 1.101.360 |
| 4 | select amplo em sitfis_results incl. pdf_base64 (Situação Fiscal) | 3.373 | 201,41 | 3.975 | 679.361 |
| 5 | count completions por completed_at (Dashboard) | 38.407 | 16,94 | 820 | 650.616 |
| 6 | obligation_instances por due_date (Dashboard) | 38.541 | 15,89 | 528 | 612.330 |
| 7 | count obligation_instances atrasadas | 38.407 | 15,47 | 270 | 594.112 |
| 8 | count chat_messages não lidas por lista de conversas | 92.270 | 3,20 | 7.025 | 295.399 |
| 9 | select completo de client_department_contacts (sem filtro) | 131.238 | 2,23 | 5.933 | 293.297 |
| 10 | select de 1 linha em chat_conversations por id | **5.037.190** | 0,05 | 2.434 | 265.133 |
| 11 | triage_learnings pendentes | 33.895 | 7,27 | 6.262 | 246.565 |
| 12 | completions por lista de instance_id | 9.512 | 22,36 | 6.828 | 212.644 |
| 13 | UPDATE chat_conversations (fechamento) | 11.336 | 17,73 | 7.242 | 200.988 |
| 14 | chat_participants por lista de conversas | 102.048 | 1,71 | 3.901 | 174.668 |
| 15 | completions por instance_id (1 por card) | 159.798 | 1,02 | 394 | 162.874 |

**Limitações destas estatísticas:** são acumuladas desde o último reset, cuja data não é exposta pela ferramenta. Portanto elas medem o histórico agregado, não o estado das últimas horas, e não permitem afirmar se as mudanças recentes já reduziram os tempos — as entradas antigas permanecem somadas no mesmo balde normalizado. Também não há aqui `rows` nem métricas de cache/leitura em disco.

## 6. Planos de execução (administrativo, sem RLS)

Executado só `EXPLAIN` (sem ANALYZE) para a consulta nº 1:

```text
Aggregate (cost=116.25..116.26)
  -> Bitmap Heap Scan on obligation_instances (cost=9.33..115.26 rows=396)
       -> Bitmap Index Scan on idx_obligation_instances_status_ref_active
```

Como administrador o plano é barato e usa o índice novo. Mas `pg_stat_user_indexes` mostra esse índice com apenas **3 scans**, contra 430 mil de `idx_obligation_instances_active`. Isso indica que a execução real (papel `authenticated`, com RLS ligada) escolhe outro plano — provavelmente porque o predicado `EXISTS(... user_can_access_department ...)` da política é aplicado linha a linha depois da varredura por `reference_month`. Não simulei a sessão autenticada, pois isso exigiria personificar um usuário, o que está fora do escopo autorizado.

## 7. Achados no código (polling, duplicação, cascatas)

- Painéis do Dashboard (`ClientsPanel`, `TasksPanel`, `TicketsPanel`, `ObligationsPanel`) já usam `refetchInterval: 60000` com `refetchIntervalInBackground: false` — a correção anterior está aplicada.
- `useUnreadCount.ts` e `Chat.tsx` ainda fazem `count exact head` em `chat_conversations`/`chat_messages`, e o realtime de `chat_messages` reexecuta esse par.
- Timers de 1 s existem em `TimeTracker`, `ConversationList`, `Dashboard`, `Auth`, `ChatInput` — são apenas relógios locais, sem chamada de rede.
- O item nº 10 do ranking (5,03 **milhões** de leituras de uma única linha de `chat_conversations`) e os itens 9 e 14 batem com o webhook do WhatsApp: `supabase/functions/whatsapp-webhook/index.ts` referencia `chat_conversations` 12 vezes e há 18 arquivos tocando `client_department_contacts` sem filtro. Esse é o maior gerador de chamadas do sistema.

## 8. Verificação do diagnóstico externo enviado (cron/pg_net)

Confirmei os tamanhos, mas **a conclusão do texto está parcialmente errada** e as ações sugeridas não resolveriam o problema.

Tamanhos reais (agora):

| tabela | tamanho total | heap | índices |
|---|---|---|---|
| cron.job_run_details | 1.028 MB | 1.010 MB | 17 MB |
| net._http_response | 573 MB | 562 MB | 11 MB |
| public.email_messages | 93 MB | — | — |
| public.invoices | 82 MB | — | — |

O que os contadores mostram:

| tabela | linhas vivas | inserções | exclusões | dead tuples | último autovacuum | seq scans |
|---|---|---|---|---|---|---|
| cron.job_run_details | 0 | 0 | 357.231 | 0 | nunca | 11 |
| net._http_response | 1.342 | 441.379 | 440.000 | 5 | 05/08/2026 | 9 |
| net.http_request_queue | 25 | 650.835 | 441.379 | 29 | — | 824.956 |

Correções ao texto recebido:
- **As duas tabelas já estão praticamente vazias.** `cron.job_run_details` tem 0 linhas vivas e 357 mil exclusões acumuladas; `net._http_response` tem 1.342 linhas. O 1,6 GB é **bloat** (espaço morto não devolvido), não histórico acumulado.
- Portanto `DELETE ... WHERE end_time < ...` e `TRUNCATE net._http_response` **não liberariam ~1,6 GB**: não há o que apagar. Só `VACUUM FULL` (ou recriação da tabela) devolve esse espaço — e `VACUUM FULL` bloqueia a tabela, exigindo janela combinada.
- Ambas quase não são lidas (9 e 11 varreduras sequenciais), então o bloat **não explica** a lentidão das telas. A tabela com leitura pesada é `net.http_request_queue`: 824.956 varreduras sequenciais e 650 mil inserções.
- Não consegui contar linhas de `cron.job_run_details` diretamente: a consulta estourou o tempo limite do conector — o que é, em si, evidência do peso da varredura nesses 1.010 MB inchados.
- Há 11 jobs de cron ativos, sendo 4 a cada minuto (`chat-waiting-alert`, `chat-inactivity-monitor`, `scheduled-messages-runner` e mais) e 1 a cada 2 minutos (`gmail-sync`). Isso gera o volume de `net.http_post` observado.
- Não pude verificar os números de "I/O 90%", "Realtime 85,8% de erros", "login 13,7 s" ou "48/60 conexões" citados no texto — essas métricas vêm do painel do Supabase, não das consultas disponíveis aqui. A amostra de `pg_stat_activity` que colhi mostrou 32 conexões e nenhum bloqueio.

## Hipóteses (separadas dos fatos)

1. **Mais provável** — o custo dominante é volume de chamadas somado ao custo por linha da RLS de `obligation_instances`/`obligation_activity_completions`, não falta de índice. Sustentação: tabelas minúsculas, índices novos ociosos, 115 mil execuções da mesma contagem com média de 123 ms.
2. **Provável** — `whatsapp-webhook` e rotinas de chat multiplicam consultas por evento (5 M leituras unitárias, 131 mil leituras integrais de contatos), consumindo conexões do pooler e atrasando as telas.
3. **Plausível** — `sitfis_results` traz `pdf_base64` em lote (média 201 ms, 20 MB de tabela), pesando na tela Situação Fiscal.
4. **Plausível** — o bloat de 1,6 GB em `cron.job_run_details` e `net._http_response` pesa no disco e na rotina de manutenção do banco (autovacuum nunca rodou em `cron.job_run_details`), mas, como essas tabelas quase não são lidas pelo app, ele não é a causa direta das telas lentas. Tratá-lo é higiene, não solução.
5. **Não confirmada** — picos de 6–7 s: sem `stats_reset` e sem amostragem temporal não é possível atribuí-los a saturação do pooler, a concorrência ou a qualquer outra causa. Não afirmo que sejam "banco acordando".

## Prioridades sugeridas de correção (não implementadas)

1. Reduzir o custo da RLS de `obligation_instances`/`obligation_activity_completions` (por exemplo, avaliação por função estável com cache por sessão ou coluna desnormalizada de departamento) e confirmar via plano autenticado qual índice passa a ser usado.
2. Cortar a repetição de chamadas do webhook do WhatsApp e das leituras integrais de `client_department_contacts`.
3. Consolidar as contagens do painel de Obrigações em uma única RPC agregada, como já feito para clientes e tarefas.
4. Não trazer `pdf_base64` na listagem de Situação Fiscal.
5. Adicionar índices secundários em `tasks` (`due_date`, `status`) e reavaliar os índices ociosos de `obligation_instances`.
6. Higiene de espaço, em janela combinada: recuperar os 1,6 GB de bloat de `cron.job_run_details` e `net._http_response` (exige `VACUUM FULL`, que bloqueia a tabela — apagar linhas não resolve, elas já não existem) e revisar a necessidade dos 4 jobs de cron que rodam a cada minuto.

## Limitações desta análise

- `pg_stat_statements` inacessível diretamente: sem `rows`, sem `shared_blks_hit/read`, sem `stats_reset`.
- Estatísticas acumuladas desde reset desconhecido; não representam necessariamente as últimas horas.
- Nenhum `EXPLAIN ANALYZE` sob RLS de usuário real, por não personificar sessão.
- Amostra única de `pg_stat_activity`: não captura picos.
