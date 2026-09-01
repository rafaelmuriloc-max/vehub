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
3. **Reprocessamento automático em segundo plano (sem botão)**: sempre que a tela de Situação Fiscal estiver aberta, uma fila silenciosa detecta os clientes com status `Erro` e refaz a consulta um a um, sem travar a interface. Se ainda falhar, espera e tenta de novo, em rodadas contínuas, até que o cliente saia do estado de erro. A lista/gráfico se atualizam sozinhos conforme cada cliente é resolvido.
4. **Fila mais tolerante no lote**: pequena pausa entre clientes para não estourar o gateway do SERPRO, que é a origem provável das falhas em massa.

## Detalhes técnicos

- `src/components/integra-contador/SituacaoFiscalTab.tsx`:
  - `consultarSitfis`: adicionar `isTransientError(msg)`, loop de até 5 ciclos com `sleep` crescente, invalidação de cache (`sitfis_invalidate_cache`) entre ciclos quando o erro for de protocolo.
  - No upsert de falha: não sobrescrever `pdf_base64`/`pendency_types` existentes quando já houver relatório válido.
  - Novo `useEffect` com worker em background: fila de clientes `status = 'error'`, processamento sequencial com pausa entre itens, novas rodadas com intervalo crescente (ex.: 30s, 60s, 120s, teto de 5 min), pausado enquanto houver consulta manual/lote em andamento e encerrado ao desmontar o componente. Sem toasts a cada tentativa — apenas atualização silenciosa dos dados.
  - `handleConsultarLote`: pausa de ~1s entre clientes.
- Sem alterações de banco de dados.
