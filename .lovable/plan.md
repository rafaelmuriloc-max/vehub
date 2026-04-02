

# Baixar XML completo e DANFE PDF de NF-e

## Diagnóstico

O sistema atual salva apenas o **resumo** (`resNFe`) retornado pela distribuição. Esse resumo contém apenas chave de acesso, emitente, valor e data — **não é o XML completo da NF-e**. Por isso, ao baixar o XML, o usuário recebe apenas a chave.

Para obter o XML completo e o DANFE PDF, é preciso:
1. **XML completo**: Fazer uma nova consulta ao Ambiente Nacional usando `consChNFe` (consulta por chave) no mesmo endpoint de distribuição
2. **DANFE PDF**: Usar o portal público `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx` ou gerar o DANFE a partir do XML

## Solução

### 1. Nova edge function `nfe-download/index.ts`

Função que recebe `{ nfe_invoice_id, type: "xml" | "pdf" }` e:

**Para XML**:
- Verifica se já tem XML completo em cache (storage)
- Se não, monta SOAP `consChNFe` para o Ambiente Nacional usando o certificado do cliente
- Envia via proxy PHP (mesmo já usado pelo nfe-query)
- Descompacta o `docZip` retornado (gzip+base64) — agora contém o `procNFe` completo
- Salva no storage `nfe/{client_id}/{access_key}.xml`
- Retorna signed URL

**Para PDF**:
- Verifica se já tem PDF em cache (storage)
- Se não, gera o DANFE a partir do XML completo usando uma abordagem simplificada: baixa o XML completo primeiro (mesmo fluxo acima) e usa o serviço público da Fazenda ou retorna o XML para o frontend gerar
- Alternativa mais prática: redirecionar para `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&nfe={chave}` (requer interação manual) ou usar API de geração de DANFE

**Abordagem recomendada para PDF**: Como não existe API pública sem captcha para baixar o DANFE, a melhor opção é:
- Gerar o DANFE no frontend usando uma lib JS como `danfe-js` ou similar
- Ou fornecer link direto para o portal da Fazenda

### 2. Atualizar `NfeTab.tsx`

- Adicionar botão de download PDF ao lado do XML
- Ambos chamam `nfe-download` com o type correspondente
- Para PDF, abrir link do portal da Fazenda em nova aba como solução imediata

### 3. Atualizar `nfe-query` para buscar XML completo

Ao invés de salvar apenas o resumo, quando o docZip retornar um `resNFe`, fazer uma segunda consulta `consChNFe` para obter o XML completo e salvar no `raw_xml`.

## Estrutura SOAP `consChNFe`

```xml
<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>1</tpAmb>
  <cUFAutor>42</cUFAutor>
  <CNPJ>{cnpj}</CNPJ>
  <consChNFe>
    <chNFe>{chave_acesso_44_digitos}</chNFe>
  </consChNFe>
</distDFeInt>
```

Mesmo endpoint, mesmo SOAPAction. A resposta retorna o `docZip` com o `procNFe` completo.

## Plano de implementação

1. **Criar `supabase/functions/nfe-download/index.ts`**: ~200 linhas, reutiliza lógica de mTLS/proxy do nfe-query
2. **Atualizar `src/components/invoices/NfeTab.tsx`**: Adicionar botões XML e PDF na tabela, com handlers que chamam a nova edge function
3. **Adicionar coluna `pdf_url`** na tabela `nfe_invoices` (se não existir) para cache do PDF

## Arquivos
- `supabase/functions/nfe-download/index.ts` (novo, ~250 linhas)
- `src/components/invoices/NfeTab.tsx` (atualizar botões de download)
- Migration: adicionar coluna `pdf_url` em `nfe_invoices` se necessário

