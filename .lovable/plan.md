# Ciência da Operação das NF-e de 08/2026 e 09/2026

## Situação atual (verificada no banco)

Notas de entrada emitidas entre 01/08/2026 e 30/09/2026 que ainda estão sem XML completo e elegíveis para manifestação: **306 notas em 34 empresas**.

Maiores volumes: M&G Administração Hoteleira (46), Mini Mercado Conte (30), Rei da Conveniência (23), Pousada 4 Estações (16), Pousada do Pescador (15).

Já resolvidas (não entram): 8 notas com `xml_baixado` e 2 já manifestadas aguardando XML.

## O que será feito

Execução operacional (sem mudança de código): disparar a rotina já existente `nfe-auto-complete` para cada uma das 34 empresas com notas pendentes. Para cada empresa ela:

1. Roda a distribuição incremental (captura resumos novos).
2. Envia a Ciência da Operação (evento 210210) em lotes de até 20 notas, para todas as entradas sem XML dos últimos 90 dias — o que cobre exatamente agosto e setembro/2026.
3. Aguarda alguns segundos e roda a distribuição de novo, colhendo os XMLs completos (procNFe) já liberados pelo Ambiente Nacional.

Regras de segurança já embutidas: máximo 3 tentativas por nota, parada imediata do cliente se a SEFAZ responder cStat 656 (consumo indevido), e nenhuma nota já com XML completo é tocada.

## Execução

- Empresas processadas em sequência, com pausa entre elas, para não acionar o bloqueio por consumo indevido do Ambiente Nacional.
- Ao final, relatório com: notas manifestadas, XMLs completos baixados, erros e quantas continuam pendentes por empresa.
- Notas que continuarem sem XML após a manifestação normalmente aparecem na distribuição seguinte (a rotina diária das 6h recolhe automaticamente).

## Detalhes técnicos

- Chamadas à Edge Function `nfe-auto-complete` (`{ client_id, wait_seconds: 10 }`) com a service role key, uma por cliente.
- Nenhuma migration, nenhuma alteração de frontend ou de Edge Function.
