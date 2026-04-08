

# Adicionar atributo Id na raiz e Reference URI com ID no XML do Termo de Autorização

## Problema
O SERPRO continua rejeitando a assinatura. A documentação e o exemplo base64 decodificado mostram que o XML deve ter um `Id` na tag raiz e a `Reference` deve apontar para esse `Id` via `URI="#..."`, não `URI=""`.

## Alterações em `supabase/functions/integra-contador/index.ts`

### 1. `generateSerproProcuradorXML` — adicionar `Id` na raiz
```typescript
// Antes:
return `<termoDeAutorizacao><dados>...`

// Depois:
const termoId = `TERMO-${Date.now()}`;
return { xml: `<termoDeAutorizacao Id="${termoId}"><dados>...`, termoId };
```
Retornar um objeto com `xml` e `termoId` para que a assinatura use o ID correto.

### 2. `signXmlWithCertificate` — receber `referenceId` e usar `URI="#referenceId"`
- Adicionar parâmetro `referenceId: string`
- Alterar `Reference URI=""` para `Reference URI="#${referenceId}"`
- Para o cálculo do digest: remover a `<Signature>` (enveloped-signature), canonicalizar, e hash — isso continua correto pois o `URI="#ID"` referencia o elemento raiz que contém todo o documento

### 3. `verifySignatureLocally` — mesma lógica (remover Signature, canonicalizar, hash)
Sem mudanças necessárias — o digest continua sendo do documento sem Signature.

### 4. `obtainProcuradorToken` — adaptar para receber `termoId`
```typescript
const { xml, termoId } = generateSerproProcuradorXML({...});
const signedXml = await signXmlWithCertificate(xml, clientPrivateKey, clientCertObj, termoId);
```

## Detalhes técnicos

```text
Estrutura XML final:
<termoDeAutorizacao Id="TERMO-1712592000000">
  <dados>
    <sistema id="API Integra Contador" />
    ...
  </dados>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      ...
      <Reference URI="#TERMO-1712592000000">
        <Transforms>
          <Transform Algorithm="...enveloped-signature" />
          <Transform Algorithm="...c14n..." />
        </Transforms>
        <DigestMethod Algorithm="...sha256" />
        <DigestValue>...</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>...</SignatureValue>
    <KeyInfo>...</KeyInfo>
  </Signature>
</termoDeAutorizacao>
```

## Arquivo alterado
- `supabase/functions/integra-contador/index.ts` — ~15 linhas alteradas em 4 funções

