
## Objetivo
Voltar a integração de NF-e para o método anterior baseado na documentação da SEF-SC, desfazendo a adaptação para o Ambiente Nacional.

## O que precisa ser alterado

### 1. `supabase/functions/nfe-query/index.ts`
Reverter a função para o contrato SEF-SC documentado nos anexos:

- Trocar a URL para:
  - Produção: `https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx`
  - Homologação: `https://hom.satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx`
- Trocar o XML de requisição de `distDFeInt` para `distNFeSC`
- Usar o namespace da SEF-SC:
  - `http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2`
- Montar a carga com os campos documentados:
  - `versao="2.00"` ou `2.02`
  - `tpAmb`
  - `verAplic`
  - `cUF=42`
  - `CNPJ`
  - `solRel > indXML=1`
  - `indAtor=9`
  - `ultNuNSU`

Exemplo esperado:
```xml
<distNFeSC versao="2.00" xmlns="http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2">
  <tpAmb>1</tpAmb>
  <verAplic>VeHub 1.0</verAplic>
  <cUF>42</cUF>
  <CNPJ>{cnpj}</CNPJ>
  <solRel>
    <indXML>1</indXML>
    <indAtor>9</indAtor>
    <ultNuNSU>{ultNSU}</ultNuNSU>
  </solRel>
</distNFeSC>
```

### 2. Parsing do retorno
Substituir o parsing atual do AN pelo formato SEF-SC:

- Ler `retDistNFeSC` / `retdistNFeSC`
- Interpretar:
  - `cStat`
  - `xMotivo`
  - `ultNuNSURet`
  - `qtDfeRet`
  - `loteDistComp`
- Descompactar `loteDistComp` (base64 + gzip)
- Parsear o XML resultante `loteDistNFeSC`
- Ler cada item `<distNFeSC NSU="..." chAcesso="...">...</distNFeSC>`

### 3. Regras de continuidade
Reverter a lógica do loop para o padrão SEF-SC:

- `117` = nenhum DF-e localizado
- `118` = DF-e localizado
- `110` = reprocessamento
- continuar imediatamente quando vier lote cheio (`qtDfeRet = 50`)
- parar quando vier menos de 50
- atualizar `clients.last_nfe_nsu` com `ultNuNSURet`

### 4. Aproveitar o que já existe
Manter sem mexer na estrutura geral já pronta:

- autenticação da edge function
- download do certificado no bucket `certificates`
- parsing do PFX
- mTLS/fallbacks já existentes
- upsert em `nfe_invoices`
- UI da aba `NF-e` em `src/components/invoices/NfeTab.tsx`

## Ajustes de compatibilidade importantes
Na reversão, eu seguiria estes cuidados para evitar quebrar o que já funciona:

- preservar `parseNfeEntry(...)` para continuar gravando na tabela atual
- adaptar apenas a origem dos documentos:
  - hoje: `docZip`
  - anterior: `loteDistComp` → `loteDistNFeSC/distNFeSC`
- garantir que o parser aceite tanto `retDistNFeSC` quanto `retdistNFeSC`, porque a documentação usa as duas grafias
- revisar o tipo/padding do NSU:
  - no XSD da SEF-SC é `xs:long` com até 18 dígitos
  - então o ideal é usar o valor numérico/string sem forçar o formato de 15 dígitos do AN

## Observação importante
Isso atende exatamente ao que você pediu: voltar para o método anterior da documentação SEF-SC. Porém, o erro original de `connection reset` provavelmente continuará existindo no Supabase, porque ele ocorre no transporte/TLS com o host da SEF-SC, não no XML.

Ou seja:
- funcionalmente o código volta ao padrão SEF-SC
- tecnicamente a integração pode continuar falhando por bloqueio de IP cloud

## Arquivos envolvidos
- `supabase/functions/nfe-query/index.ts` — reversão principal
- `src/components/invoices/NfeTab.tsx` — opcionalmente só ajustar o texto do card/título se necessário

## Resumo técnico
```text
Atual:
UI -> nfe-query -> Ambiente Nacional -> retDistDFeInt -> docZip

Após reversão:
UI -> nfe-query -> SEF-SC nfedownloadV2 -> retDistNFeSC -> loteDistComp -> loteDistNFeSC/distNFeSC
```
