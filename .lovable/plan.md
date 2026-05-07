# Migrar para NFeDistribuicaoDFe (Ambiente Nacional)

## Contexto

O endpoint atual `nfeDownloadContab` da SEF-SC está rejeitando a requisição (`Server did not recognize the value of HTTP Header SOAPAction`). Em vez de continuar diagnosticando esse WS legado, vamos migrar para o serviço nacional **NFeDistribuicaoDFe**, que retorna o `<procNFe>` completo (mesmo padrão base64+gzip já implementado) e funciona em todas as UFs.

Mudança chave: cada chamada usa o **certificado da própria empresa consultada** (já cadastrado em `clients.digital_certificate_url` / `digital_certificate_password`), não o certificado do contador.

## O que muda

### 1. `supabase/functions/nfe-download/index.ts`

- **Endpoint**: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- **Namespace**: `http://www.portalfiscal.inf.br/nfe`
- **SOAPAction**: `http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse`
- **Certificado**: carregar de `clients.digital_certificate_url` (bucket `certificates`) com a senha em `clients.digital_certificate_password`. Remover o fallback para `company_settings.accountant_certificate_url`.
- **Validação prévia**: se o cliente não tiver certificado/senha, retornar 400 com `reason: "client_cert_missing"` e mensagem orientando o cadastro do certificado A1 do cliente em CRM → Empresa.
- **Envelope SOAP** (`consChNFe` por chave):

```xml
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUFAutor>{cUF}</cUFAutor>
          <CNPJ>{cnpjCliente}</CNPJ>
          <consChNFe><chNFe>{chave}</chNFe></consChNFe>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>
```

  - `cUF` derivado dos 2 primeiros dígitos da chave de acesso.
  - `Content-Type: application/soap+xml; charset=utf-8; action="..."` (SOAP 1.2, exigido pelo AN).

- **Parse da resposta**:
  - `retDistDFeInt` → `cStat` `138` indica documentos disponíveis.
  - Iterar `<docZip NSU="..." schema="procNFe_v4.00">` e localizar o que contém a chave correta (ou o único retornado).
  - Decodificar base64 + gunzip (já temos `decompressGzip`).
  - Resultado é o `<nfeProc>` completo com `<det>`, `<dest>`, `<total>`.

- **Tratamento de erros AN específicos**:
  - `137` "Nenhum documento localizado" → orientar a fazer Manifestação do Destinatário (Ciência da Operação) antes do download.
  - `656` "Consumo indevido" → throttle (1 chamada / hora por CNPJ).
  - `108`/`109` indisponibilidade → mensagem de retentar mais tarde.
  - Outros → propagar `cStat`/`xMotivo`.

- Manter logs de body snippet (já adicionados) para diagnóstico.
- Manter caminho via `NFE_PROXY_URL` (Hostinger) — apenas trocar URL/headers/envelope.

### 2. `src/components/invoices/NfeTab.tsx`

- Atualizar o toast inicial para "Buscando XML completo no Ambiente Nacional…".
- Trocar tratamento `reason === "contador_cert_missing"` por `"client_cert_missing"`, com link para a tela do cliente em vez de Configurações.
- Adicionar mensagem específica para `cStat=137`: "NF-e ainda não disponível para download. Faça a Manifestação do Destinatário (Ciência da Operação) antes."

### 3. Sem mudanças em banco

- `clients.digital_certificate_url` e `digital_certificate_password` já existem.
- `company_settings.accountant_certificate_*` permanecem (continuam sendo usados pela integração SERPRO/Integra Contador).

## Validação

1. Em `/invoices`, selecionar uma NF-e cuja empresa cliente tenha certificado A1 cadastrado.
2. Clicar "Baixar XML" → toast AN → resposta `cStat=138` → `<nfeProc>` salvo em `documents/nfe/{client_id}/{chave}.xml`, `nfe_invoices` atualizada com emitter/recipient/total.
3. Para empresa sem certificado → toast claro pedindo cadastro.
4. Para NF-e sem manifestação → toast `cStat=137` orientando.
