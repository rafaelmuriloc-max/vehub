# Corrigir chamados com fechamento anterior à abertura

## O que está acontecendo

Hoje existem 25 chamados; 2 deles (nº 20 e nº 22) têm data de fechamento anterior à abertura:

- Chamado 22: abertura 02/09 14:36, fechamento 01/09 21:00
- Chamado 20: abertura 02/09 14:20, fechamento 31/08 15:08

Causa confirmada: o backfill que criou os chamados do dia usou como **abertura** a primeira mensagem do período consultado (hoje), mas como **fechamento** o `closed_at` que já estava gravado na conversa — de dias anteriores. Conversas antigas já fechadas ganharam abertura "de hoje" e fechamento no passado.

O fluxo normal (gatilho de fechamento no banco) não gera esse problema, pois usa `now()` no momento do fechamento.

## Correção

1. **Corrigir os 2 chamados existentes**: definir o fechamento como a data/hora da última mensagem da conversa (ou, na falta dela, a abertura) e recalcular a duração. Rodar uma verificação para garantir zero chamados invertidos.

2. **Corrigir o backfill** (`ticket-summarize`): ao criar um chamado a partir de conversa já fechada, só usar o fechamento da conversa se ele for posterior à abertura; caso contrário usar a última mensagem. E ancorar a abertura na criação da conversa quando ela for anterior à primeira mensagem do período.

3. **Proteção no banco**: gatilho de validação em `support_tickets` que, em qualquer inserção/atualização, ajusta o fechamento para nunca ser anterior à abertura (usa a abertura quando vier inválido) e mantém a duração coerente.

4. **Proteção na tela** (`Tickets.tsx`): quando a diferença for negativa, exibir a duração como "—" em vez de valor inconsistente.

## Detalhes técnicos

- Migração: UPDATE corretivo nos registros invertidos + função/gatilho `BEFORE INSERT OR UPDATE` normalizando `closed_at` e `handle_seconds`.
- Edge function: ajuste no bloco de criação do backfill (`opened_at` / `closed_at`).
- Frontend: guarda em `fmtDuration` na página de chamados.
