

# Plano: Emissão de NFS-e (Nota Fiscal de Serviço Eletrônica)

## Contexto

A emissão de NFS-e é feita via **POST /nfse** na API SEFIN Nacional (`https://sefin.nfse.gov.br/SefinNacional/nfse`). O fluxo requer:
1. Montar o XML da DPS (Declaração de Prestação de Serviço)
2. Assinar digitalmente o XML com o certificado A1 do cliente
3. Comprimir (gzip) e codificar em base64
4. Enviar como JSON `{ "dpsXmlGZipB64": "..." }` via mTLS
5. Processar a resposta (NFS-e gerada ou rejeição)

A infraestrutura mTLS e parsing de PFX já existem em `nfse-query`. Vamos reutilizar.

## Entregas

### 1. Nova Edge Function `nfse-emit`

**Arquivo**: `supabase/functions/nfse-emit/index.ts`

- Recebe via POST: `{ client_id, dps_data }` onde `dps_data` contém os campos da DPS (tomador, serviço, valores, município, etc.)
- Carrega certificado do cliente (mesmo fluxo do `nfse-query`)
- Gera o XML da DPS conforme leiaute oficial (infDPS com campos obrigatórios)
- Assina o XML digitalmente usando `node-forge` (assinatura RSA-SHA256 com enveloped signature no nó `infDPS`)
- Comprime com gzip e codifica em base64
- Envia `POST /nfse` com `{ "dpsXmlGZipB64": "..." }` via mTLS (reutilizando `requestWithFetchHttp1`)
- Processa resposta: se sucesso, salva NFS-e no banco `invoices`; se rejeição, retorna os motivos
- Endpoint SEFIN: produção `https://sefin.nfse.gov.br/SefinNacional/nfse`, homologação `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse`

### 2. Formulário de Emissão na UI

**Arquivo**: `src/pages/InvoiceEmit.tsx` (nova página)

Formulário com os campos essenciais da DPS:
- **Prestador**: preenchido automaticamente com dados do cliente selecionado (CNPJ, inscrição municipal, código município)
- **Tomador**: CNPJ/CPF, razão social, endereço
- **Serviço**: código de serviço (LC 116), descrição, valor do serviço, alíquota ISS
- **Valores**: valor bruto, deduções, valor líquido, ISS retido
- **Competência**: mês/ano de referência
- **Município de incidência** e **local da prestação**

Botão "Emitir NFS-e" que invoca a edge function e exibe resultado (sucesso com chave de acesso ou erros de validação).

### 3. Ajustes de Roteamento e Navegação

- **`src/App.tsx`**: adicionar rota `/invoices/emit`
- **`src/pages/Invoices.tsx`**: adicionar botão "Emitir NFS-e" (admin only) que navega para `/invoices/emit`

### 4. Config TOML

- Adicionar `[functions.nfse-emit]` com `verify_jwt = false` em `supabase/config.toml`

## Detalhes Técnicos

### Geração do XML da DPS

O XML segue o leiaute oficial do Sistema Nacional NFS-e. Estrutura simplificada:

```text
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="DPS{idDPS}">
    <tpAmb>1</tpAmb>
    <dhEmi>2026-03-17T10:00:00-03:00</dhEmi>
    <verAplic>Lovable-1.0</verAplic>
    <serie>EPN</serie>
    <nDPS>000000000000001</nDPS>
    <dCompet>2026-03-01</dCompet>
    <prest>
      <CNPJ>...</CNPJ>
      <IM>...</IM>
    </prest>
    <toma>
      <CNPJ>...</CNPJ>
      <xNome>...</xNome>
    </toma>
    <serv>
      <cServ>...</cServ>
      <xDescServ>...</xDescServ>
      <vServ>100.00</vServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>100.00</vServ>
      </vServPrest>
    </valores>
  </infDPS>
</DPS>
```

### Assinatura Digital

Usando `node-forge` (já disponível):
- Canonical XML (C14N simplificado) do nó `infDPS`
- Hash SHA-256
- Assinatura RSA com a chave privada do certificado A1
- Inserir nó `<Signature>` (XMLDSig enveloped) dentro do `<DPS>`

### Compressão e Envio

```typescript
// gzip + base64
const gzipped = await gzipCompress(signedXml);
const b64 = btoa(String.fromCharCode(...gzipped));
const payload = JSON.stringify({ dpsXmlGZipB64: b64 });

// POST via mTLS
const response = await requestWithFetchHttp1(
  new URL("https://sefin.nfse.gov.br/SefinNacional/nfse"),
  { method: "POST", body: payload, headers: { "Content-Type": "application/json" } },
  certPem, keyPem, "emit"
);
```

## Observação sobre Ambiente

O formulário incluirá um toggle para ambiente (produção vs homologação) para permitir testes em produção restrita antes de emitir notas reais.

