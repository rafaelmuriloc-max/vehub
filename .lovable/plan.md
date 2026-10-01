# Captura de NF-e de saída pela SEFAZ-SC

## O que muda para você
- As notas que as empresas **emitiram** (saídas) passam a aparecer em Notas Fiscais → NF-e, na aba Saídas, com XML e DANFE.
- O botão Sincronizar da NF-e busca entradas (como hoje) e também saídas.
- A rotina diária das 6h também passa a buscar as saídas.
- Empresas em que o contador não está vinculado no SAT aparecem com o aviso "sem vínculo de contabilista", igual à NFC-e.

## Como vai funcionar
1. Nova busca no serviço de download para contadores da SEFAZ-SC, usando o certificado do contador (e o do escritório como reserva), o mesmo já usado na NFC-e.
2. Filtro "emitente OU destinatário", lendo de onde parou (ponto de leitura próprio, separado do de entradas).
3. Quando a SEFAZ disser "nada mais", a empresa espera 12h para a próxima busca (regra da SEFAZ). Recusas não travam.
4. Notas que já existem como entrada não são duplicadas nem rebaixadas (nota com XML completo nunca volta a resumo).
5. Cancelamentos recebidos vão para a lista de eventos e marcam a nota como cancelada.

## Detalhes técnicos
- Migração: `clients.last_nfe_sc_nsu text default '0'`, `clients.nfe_sc_next_query_at timestamptz`.
- Nova edge function `nfe-sc-query` (modelo de `nfce-query`): URL `https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx`, namespace `http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2`, operação `NfeDownloadContab`, envelope `distNFeSC` com `<solRel><indXML>1</indXML><indAtor>3</indAtor><ultNuNSU>`; opção por chave (`solDFe/chAcesso`). mTLS via proxy `NFE_PROXY_URL` com fallback direto; certificados via `_shared/certificate.ts`; cStat 8002 troca certificado; 117 bloqueia 12h; 657 bloqueia 1h; 118 processa lote GZip/Base64; tempo limite 100s com `more: true`.
- Gravação em `nfe_invoices` (upsert por `access_key`, deduplicado, fallback linha a linha), `direction` por emitente = CNPJ do cliente, XML em `documents/nfe/{client_id}/{chave}.xml`; sem sobrescrever registros `xml_baixado`. Eventos em `nfe_events`.
- `NfeTab.tsx`: Sincronizar chama `nfe-query` e depois `nfe-sc-query` (repetindo enquanto `more`), mostra aviso de recusa e horário da próxima busca de saídas.
- `nfe-nfse-daily-sync`: chama `nfe-sc-query` por cliente com pausa (respeitando 8 req/s).
- Teste inicial com a Pizzaria Baú do Tesouro (53.990.547/0001-48) pelos registros da função.
- Atualizar a memória "SEFAZ-SC sem WS saída", que deixa de valer.
