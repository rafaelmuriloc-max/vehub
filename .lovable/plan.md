# Eliminar o status "Erro" na Situação Fiscal com retentativa automática

## Diagnóstico

Os 22 registros com status `Erro` hoje são, na prática, falhas transitórias:

- 15 — "Failed to send a request to the Edge Function" (queda/timeout da chamada, não recusa do SERPRO)
- 4 — "Consulta incompleta - reconsultar"
- 1 — "Protocolo expirado no SERPRO. Reconsulte este cliente."

A consulta atual só tenta 2 ciclos e, no primeiro insucesso, grava `error` definitivamente. Nenhum desses casos é uma negativa real do SERPRO — todos passam ao repetir.

## Correção

1. **Retentativa com backoff dentro da consulta**: classificar o erro antes de gravar.
   - Erros transitórios (falha de rede/Edge Function, timeout, 5xx, gateway, protocolo expirado ER05, "relatório não ficou pronto") → repetir automaticamente com espera progressiva (ex.: 2s, 5s, 10s, 20s, 30s), até 5 ciclos, invalidando o cache do protocolo entre ciclos.
   - Erro de procuração continua gravando `sem_procuracao` de imediato (não adianta insistir).
2. **Só gravar `error` em último caso**: se após todos os ciclos ainda falhar, mantém o registro anterior do cliente (não apaga PDF válido já existente) e grava a mensagem real do último erro.
3. **Botão "Reprocessar erros"**: ação na barra de ferramentas que pega todos os clientes com status `Erro` (ou sem consulta) e roda a consulta em fila, com barra de progresso, repetindo os que continuarem falhando por até 3 rodadas — a meta é zerar o card de Erro.
4. **Fila mais tolerante no lote**: pequena pausa entre clientes para não estourar o gateway do SERPRO, que é a origem provável das falhas em massa.

## Detalhes técnicos

- `src/components/integra-contador/SituacaoFiscalTab.tsx`:
  - `consultarSitfis`: adicionar `isTransientError(msg)`, loop de até 5 ciclos com `sleep` crescente, invalidação de cache (`sitfis_invalidate_cache`) entre ciclos quando o erro for de protocolo.
  - No upsert de falha: não sobrescrever `pdf_base64`/`pendency_types` existentes quando já houver relatório válido.
  - Novo handler `handleReprocessarErros()` + botão, reusando `consultarSitfis` com até 3 rodadas sobre os que restarem em erro.
  - `handleConsultarLote`: pausa de ~1s entre clientes.
- Sem alterações de banco de dados.
