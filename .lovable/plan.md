

# Corrigir NF-e: usar endpoint nacional (AN) em vez do SEF-SC

## Problema
O endpoint `satnfe.sef.sc.gov.br` bloqueia conexões de IPs cloud (Supabase). Todas as tentativas de conexão resultam em "connection reset".

## Solução
Trocar para o Web Service nacional de Distribuição de DF-e (Ambiente Nacional - AN), que aceita conexões cloud (assim como o `adn.nfse.gov.br` funciona para NFS-e).

- **Produção**: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- **Homologação**: `https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`

## Alterações em `supabase/functions/nfe-query/index.ts`

### 1. Trocar URL e SOAP
- URL: `www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- SOAPAction: `http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse`
- Namespace: `http://www.portalfiscal.inf.br/nfe`

### 2. Alterar XML de request
De `distNFeSC` (schema SC) para `distDFeInt` (schema nacional):
```xml
<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>1</tpAmb>
  <cUFAutor>42</cUFAutor>
  <CNPJ>{cnpj}</CNPJ>
  <distNSU>
    <ultNSU>{ultNSU}</ultNSU>
  </distNSU>
</distDFeInt>
```

### 3. Alterar parsing do response
- Tag de retorno: `retDistDFeInt` em vez de `retDistNFeSC`
- Lote comprimido: `docZip` (base64 gzip) dentro de `loteDistDFeInt`
- Cada documento vem em `<docZip NSU="..." schema="...">base64gzip</docZip>`
- Campo `maxNSU` e `ultNSU` no retorno
- Continue loop: `cStat=138` (documentos localizados) em vez de `118`

### 4. Manter toda lógica de mTLS, upsert e parsing de NF-e
A lógica de PFX, certificado, upsert em `nfe_invoices` e atualização de `last_nfe_nsu` permanece igual. Apenas o transporte SOAP e parsing do envelope mudam.

## Arquivo modificado
- `supabase/functions/nfe-query/index.ts`

