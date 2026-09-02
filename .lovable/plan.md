# Busca automática diária de notas fiscais (6h)

## O que será feito

Todo dia às 6h (horário de Brasília) o sistema busca sozinho as notas fiscais do dia anterior, sem ninguém precisar clicar em "Sincronizar".

- Cobre NF-e (entradas, Ambiente Nacional) e NFS-e (ADN).
- Roda para todos os clientes ativos com CNPJ e certificado digital válido — mesmo critério do botão de sincronização em lote.
- Período: apenas o dia anterior (NF-e por intervalo de datas; NFS-e pelo mês de referência do dia anterior, já que a consulta ADN é por NSU/competência).

## Como funciona

1. Nova Edge Function `nfe-nfse-daily-sync`:
   - Seleciona os clientes elegíveis (ativos, com CNPJ e certificado não vencido).
   - Para cada cliente, chama `nfe-query` (com `date_from`/`date_to` = dia anterior) e `nfse-query` (mês do dia anterior), em sequência, com pequena pausa entre clientes para não sobrecarregar SEFAZ/ADN.
   - Erros por cliente não interrompem a rotina: são registrados e a execução segue.
   - Trava de execução única (lease com expiração) para não rodar duas vezes em paralelo, e limite máximo de clientes por execução com retomada na próxima chamada.
   - Registro de cada execução em uma tabela `nfe_sync_runs` (início, fim, quantidade de sucessos/erros, mensagens), para acompanhamento.
2. Agendamento com `pg_cron` chamando a função às 09:00 UTC (06:00 em Brasília), todos os dias.

## Cadência e custo

O job roda 1 vez por dia. É a menor frequência que atende "todo dia às 6h buscando o dia anterior". O atraso máximo entre a emissão de uma nota e ela aparecer no sistema é de até ~30 horas; quem precisar antes continua podendo sincronizar manualmente na tela de Notas Fiscais.

## Detalhes técnicos

- Nova função: `supabase/functions/nfe-nfse-daily-sync/index.ts` (service role; chama as funções existentes `nfe-query` e `nfse-query` sem alterar a lógica delas).
- Nova tabela `public.nfe_sync_runs` com GRANTs (`select` para authenticated, `all` para service_role), RLS habilitado e política de leitura para usuários autenticados; escrita somente pelo service_role.
- Tabela de lease (ou linha de controle em `nfe_sync_runs` com status `running` + expiração) para a trava de execução única.
- Agendamento via `cron.schedule('nfe-nfse-daily-sync', '0 9 * * *', ...)` usando `net.http_post` para a URL da função com a publishable key do projeto.
- Sem alterações nas telas NF-e/NFS-e; elas continuam lendo as tabelas normalmente.
