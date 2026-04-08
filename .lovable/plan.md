

# Corrigir XML do Termo de Autorização (Autentica Procurador)

## Problema

O SERPRO retorna: **"Layout do XML inválido: tag raiz deve ser termoDeAutorizacao."**

O XML atual usa `<TermoAutorizacao>` com estrutura simplificada. A documentação oficial exige `<termoDeAutorizacao>` com uma estrutura completamente diferente contendo vários campos obrigatórios.

## Estrutura esperada pelo SERPRO

```xml
<termoDeAutorizacao>
  <dados>
    <sistema id="API Integra Contador" />
    <termo texto="Autorizo a empresa CONTRATANTE..." />
    <avisoLegal texto="O acesso a estas informações..." />
    <finalidade texto="A finalidade única e exclusiva..." />
    <dataAssinatura data="20260408" />
    <vigencia data="20261231" />
    <destinatario numero="CNPJ_CONTRATANTE" nome="NOME_CONTRATANTE" tipo="PJ" papel="contratante" />
    <assinadoPor numero="CNPJ_CLIENTE" nome="NOME_CLIENTE" tipo="PJ" papel="autor pedido de dados" />
  </dados>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
</termoDeAutorizacao>
```

## Solução

### `supabase/functions/integra-contador/index.ts`

1. **Reescrever `generateSerproProcuradorXML`** para gerar o XML com a tag raiz `<termoDeAutorizacao>` e todos os elementos filhos dentro de `<dados>`:
   - `<sistema>`, `<termo>`, `<avisoLegal>`, `<finalidade>` com textos legais fixos
   - `<dataAssinatura>` e `<vigencia>` dinâmicos
   - `<destinatario>` com dados do contratante (escritório)
   - `<assinadoPor>` com dados do autor/cliente
   - Tags auto-fechantes (`/>`) são usadas no XML original da documentação

2. **Atualizar `signXmlWithCertificate`** para usar a nova tag raiz `</termoDeAutorizacao>` no insert da assinatura.

3. **Atualizar `obtainProcuradorToken`** para passar nomes do contratante e do cliente para o XML.

## Detalhes técnicos

- A vigência será configurada para o último dia do ano corrente
- Os textos legais (LGPD, termo, finalidade) são fixos conforme documentação SERPRO
- A assinatura digital continua com o mesmo algoritmo (RSA-SHA256)
- O digest deve ser calculado sobre o conteúdo sem a declaração XML

## Arquivo alterado
- `supabase/functions/integra-contador/index.ts` — reescrever ~30 linhas da função `generateSerproProcuradorXML` + ajuste de 1 linha no `signXmlWithCertificate`

