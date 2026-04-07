

# Refatorar geração do XML do Termo de Autorização (Integra Contador)

## Contexto
O SERPRO continua retornando `403 XML assinado inválido` mesmo após a correção das tags auto-fechantes no corpo do XML. Analisando os logs, identifico **dois problemas adicionais na assinatura**:

1. **SignedInfo com tags auto-fechantes**: As tags `<CanonicalizationMethod ... />`, `<SignatureMethod ... />`, `<DigestMethod ... />` e `<Transform ... />` dentro do `<SignedInfo>` usam formato auto-fechante. Quando o SERPRO canonicaliza o SignedInfo para verificar a assinatura RSA, essas tags são expandidas, mudando os bytes — a assinatura não bate.

2. **Estrutura do XML**: O usuário quer adotar uma estrutura mais limpa e padronizada com `<TermoAutorizacao Id="...">` e atributo `Id` para referência da assinatura XMLDSig.

## Alterações

### `supabase/functions/integra-contador/index.ts`

**1. Nova função `generateSerproProcuradorXML`** (substitui `generateAuthorizationXml`):
- Estrutura simplificada com `<TermoAutorizacao Id="TERMO_xxx">` como raiz
- Elementos filhos: `<Contratante>`, `<AutorPedido>`, `<Contribuinte>`, `<DataHora>`
- Id único baseado em timestamp para referência da assinatura
- Data/hora no formato ISO 8601 com timezone Brasil (`-03:00`)
- XML declaration `<?xml version="1.0" encoding="UTF-8"?>`
- Sem tags auto-fechantes em nenhum lugar

**2. Nova função `toBase64`**:
- Recebe string XML, codifica em UTF-8 e retorna base64
- Pronta para uso no payload `{ "dados": "{\"xml\":\"BASE64\"}" }`

**3. Corrigir `signXmlWithCertificate`**:
- Expandir TODAS as tags auto-fechantes no SignedInfo: `<CanonicalizationMethod>`, `<SignatureMethod>`, `<DigestMethod>`, `<Transform>` — todas devem ter fechamento explícito
- Usar `Reference URI="#ID_DO_TERMO"` em vez de `URI=""` para referenciar o Id do TermoAutorizacao
- Manter o restante da lógica de assinatura (SHA-256, RSASSA-PKCS1-v1_5)

**4. Atualizar `obtainProcuradorToken`**:
- Usar `generateSerproProcuradorXML` em vez de `generateAuthorizationXml`
- Usar `toBase64` para a conversão
- Adicionar log do XML gerado (primeiros 500 chars) para debug

## Estrutura final do XML gerado

```text
<?xml version="1.0" encoding="UTF-8"?>
<TermoAutorizacao Id="TERMO_1712451600000">
  <Contratante>59400171000150</Contratante>
  <AutorPedido>39427518000141</AutorPedido>
  <Contribuinte>39427518000141</Contribuinte>
  <DataHora>2026-04-07T00:00:00-03:00</DataHora>
</TermoAutorizacao>
```

## Arquivo alterado
- `supabase/functions/integra-contador/index.ts` — funções `generateSerproProcuradorXML`, `toBase64`, `signXmlWithCertificate` corrigida, `obtainProcuradorToken` atualizada

