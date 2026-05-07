## Problema

A `nfe-download` consulta o **Ambiente Nacional** (AN) com o certificado do cliente. O AN só libera `<nfeProc>` completo após Manifestação do Destinatário — sem isso, devolve apenas `<resNFe>` (sem itens, sem destinatário, sem `nNF`), inviabilizando o DANFE.

## Solução

Usar o WS **`NfeDownload` / `nfeDownloadContab`** da SEF-SC (BT-SC-2021-001 v2.02), que entrega `<nfeProc>` completo para escritórios contábeis sem depender de manifestação. Autentica via mTLS com o **certificado do contador já cadastrado** em `company_settings.accountant_certificate_url` / `.accountant_certificate_password`.

## Mudanças

### 1. `supabase/functions/nfe-download/index.ts` — Trocar AN por SEF-SC

Substituir o fluxo atual:

- Constantes:
  ```ts
  const SEF_SC_URL  = "https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx";
  const SEF_SC_NS   = "http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2";
  const SOAP_ACTION = `${SEF_SC_NS}/nfeDownloadContab`;
  ```
- Carregar certificado do contador:
  ```ts
  const { data: office } = await adminClient
    .from("company_settings")
    .select("accountant_certificate_url, accountant_certificate_password")
    .limit(1).single();
  ```
  Se ausente → erro 400 (`reason: "contador_cert_missing"`, mensagem orientando Configurações → Empresa).
- Buscar CNPJ do cliente (`clients.document`).
- Montar SOAP envelope com payload SEF-SC:
  ```xml
  <distNFeSC versao="2.00" xmlns="http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2">
    <tpAmb>1</tpAmb>
    <verAplic>velocita 1.0</verAplic>
    <cUF>42</cUF>
    <CNPJ>{cnpjCliente}</CNPJ>
    <solDFe><chAcesso>{chave44}</chAcesso></solDFe>
  </distNFeSC>
  ```
- Enviar via `NFE_PROXY_URL` (Hostinger) com `certPem`/`keyPem` do contador.
- Resposta: `<retDistNFeSC>` → `cStat=138` → `<loteDistComp>` (base64+gzip) → descompactar → `<loteDistNFeSC>` contendo `<distNFeSC><nfeProc>…</nfeProc></distNFeSC>`.
- Extrair `<nfeProc>` interno como `fullXml`, salvar em `documents/nfe/{client_id}/{chave}.xml`, atualizar `nfe_invoices` (`xml_url`, `raw_xml`, `emitter_*`, `recipient_*`, `invoice_number`, `total_value`).
- Retornar signed URL (10 min).
- Mapear erros 282/283 (sem vínculo de contador no e-SAT/SC) com mensagem clara.

### 2. UI — `src/components/invoices/NfeTab.tsx`

- Toast "Buscando XML completo na SEF-SC…" antes do `invoke('nfe-download')`.
- Tratar `reason: "contador_cert_missing"` com toast linkando Configurações.

## Validação

- Em `/invoices` → "Baixar XML" em uma NF-e SC → retorna `<nfeProc>` completo com `<det>`, `<dest>`, `<total>`.
- "Baixar DANFE" → PDF gerado.
- Logs do edge function: `cStat=138` e `loteDistComp` decompactado.

## Notas

- Limite 50 documentos por requisição.
- WS atende somente NF-e de SC (cUF=42). Para outras UFs continua dependendo do AN + Manifestação (fora deste escopo).
- Se SEF-SC retornar 282/283 etc., o contador não está vinculado ao CNPJ do cliente no e-SAT/SC — configuração externa.
