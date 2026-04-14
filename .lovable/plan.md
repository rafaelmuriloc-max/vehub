

# Retry com novo token de procurador ao receber 403

## Problema

O fluxo de procuração funciona assim:
1. `obtainProcuradorToken` busca o token no cache (`procurador_tokens`)
2. Se encontra (dentro da validade de 24h), retorna direto
3. O token é enviado no header `autenticar_procurador_token`
4. SERPRO retorna 403 "AcessoNegado" mesmo com o token

O problema: o token cacheado está inválido no lado do SERPRO (pode ter sido revogado ou expirado antes das 24h), mas o sistema não tenta obter um novo -- simplesmente retorna o erro 403.

## Solução

Adicionar retry no `supabase/functions/integra-contador/index.ts`: quando a API retorna 403 e o `procuradorToken` veio do cache, invalidar o cache, obter um novo token (re-assinar o XML), e repetir a chamada.

### Mudanças em `supabase/functions/integra-contador/index.ts`

1. **Após a chamada `callSerproApi`** (linha ~790): adicionar lógica de retry para 403 quando `procuradorToken` está presente:
   - Deletar o token do cache (`procurador_tokens`)
   - Re-executar `obtainProcuradorToken` (que agora não encontra cache e gera XML assinado fresco)
   - Atualizar `procuradorToken` e repetir `callSerproApi`

2. **Para isso funcionar**, as variáveis do certificado do cliente precisam estar acessíveis no escopo do retry. Atualmente o download/parse do certificado do cliente ocorre dentro do bloco `if (autorPedidoCpfCnpj !== contratanteCnpj)`. Basta manter referências dessas variáveis no escopo externo.

Trecho aproximado da mudança (após linha 801):

```typescript
// Retry on 403 with procurador token (cached token may be stale)
if (apiResponse.status === 403 && procuradorToken) {
  console.log(`[integra-contador] 403 com procuradorToken — invalidando cache e re-obtendo token...`);
  
  // Delete stale cache
  await serviceClient.from("procurador_tokens")
    .delete()
    .eq("contratante_cnpj", contratanteCnpj)
    .eq("client_cnpj", clientCnpjClean);
  
  // Re-obtain procurador token (will sign XML fresh)
  const freshToken = await obtainProcuradorToken(...);
  if (typeof freshToken === "string" && freshToken.length > 0) {
    procuradorToken = freshToken;
    apiResponse = await callSerproApi(bearerToken, jwtToken);
  }
}
```

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/integra-contador/index.ts` | Retry 403 invalidando cache do procurador e re-assinando XML |

