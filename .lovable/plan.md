

# Corrigir consulta NF-e: trocar para Ambiente Nacional

## Diagnóstico

O endpoint atual (`satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx`) é exclusivo para **contabilistas registrados** na SEFAZ-SC (método `NfeDownloadContab`). A maioria dos clientes retorna **erro 8002** ("Requisitante não é Contabilista do CNPJ/CPF informado") porque o contador não está registrado na SEFAZ para cada cliente. Apenas 2 clientes passaram (retornaram 117 = sem notas). Total de notas salvas: **0**.

## Solução

Trocar para o **Ambiente Nacional** (`NFeDistribuicaoDFe`), que:
- Usa o **certificado do próprio cliente** (não do contador)
- Não exige registro de contabilista
- Funciona para qualquer CNPJ com certificado A1 válido

## Detalhes técnicos

### Endpoint
`https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`

### SOAP
```text
SOAPAction: http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse

<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>1</tpAmb>
  <cUFAutor>42</cUFAutor>
  <CNPJ>{cnpj_cliente}</CNPJ>
  <distNSU>
    <ultNSU>{ultimo_nsu}</ultNSU>
  </distNSU>
</distDFeInt>
```

### Mudanças no `supabase/functions/nfe-query/index.ts`
1. Trocar URL, SOAPAction e namespace para o Ambiente Nacional
2. Ajustar `buildSoapRequest` para gerar `distDFeInt` com wrapper `nfeDistDFeInteresse`
3. Voltar a usar o **certificado do cliente** (da tabela `clients`) em vez do certificado do contador
4. Ajustar parsing da resposta: tags `retDistDFeInt`, `docZip`, `loteDistDFeInt` em vez de `retDistNFeSC`, `loteDistComp`
5. Usar campo `last_nfe_nsu` existente no cliente para controle de NSU

### Mudanças no `src/components/invoices/NfeTab.tsx`
1. No `handleSync` ao selecionar "todos", filtrar clientes que tenham `document` e `digital_certificate_url` válido (já faz isso)
2. Atualizar mensagens de erro para refletir "Ambiente Nacional" em vez de "SEF-SC"

### Mudança no proxy PHP (`.lovable/tmp/proxy-nfe.php`)
- Nenhuma mudança necessária — o proxy já é genérico (recebe URL destino como parâmetro)

## Fluxo
```text
Edge Function → carrega cert do CLIENTE → monta SOAP distDFeInt
    → envia via proxy PHP → AN (www1.nfe.fazenda.gov.br)
    → recebe docZip (gzip+base64) → descompacta → parse NF-e
    → upsert nfe_invoices → atualiza last_nfe_nsu
```

## Arquivos
- `supabase/functions/nfe-query/index.ts` (reescrever SOAP e parsing, ~50 linhas alteradas)
- `src/components/invoices/NfeTab.tsx` (ajustar mensagens, ~5 linhas)

