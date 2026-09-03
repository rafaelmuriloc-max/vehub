# Rodada extra de distribuição para capturar XMLs pendentes (08–09/2026)

## Objetivo
Disparar agora uma nova rodada de distribuição incremental (distNSU) para os clientes que ainda têm 228 notas de 08/2026 e 09/2026 com `manifest_status='enviada'` e `xml_url` nulo, capturando os procNFe que o Ambiente Nacional já liberou.

## Passos
1. Consultar os clientes com pendência (`manifest_status='enviada'` AND `xml_url IS NULL` AND `issue_date` entre 01/08/2026 e 30/09/2026).
2. Disparar chamadas assíncronas via `net.http_post` para `nfe-nfse-daily-sync` com `x-cron-secret`, uma por cliente, usando `reference_date` distinto por chamada para evitar o lock de run diária (`already_running`).
3. Aguardar e consultar `net._http_response` para verificar conclusão e contadores (`nfe_xml_completos`).
4. Recontar `nfe_invoices` por `manifest_status`/`status` no período e reportar quantos XMLs novos chegaram e quantos continuam aguardando o AN.

## Observações
- Sem alteração de código ou de banco (somente execução operacional).
- O que não chegar nesta rodada será capturado pela rotina automática das 6h nas próximas distribuições do AN.
