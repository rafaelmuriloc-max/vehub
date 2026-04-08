

# Corrigir header jwt_token no AUTENTICAPROCURADOR

## Problema
O erro mudou para `[AcessoNegado-ICGERENCIADOR-041] HEADER jwt_token inválido.` -- um erro do **gateway** (ICGERENCIADOR), não do serviço AUTENTICAPROCURADOR em si.

A documentação do SERPRO diz que para o AUTENTICAPROCURADOR o `jwt_token` deve ser **"vazio (não precisa preencher)"**. Isso significa que o header deve estar **presente com valor vazio**, e nao **omitido**. O codigo atual omite o header completamente, e o gateway rejeita a requisicao antes mesmo de chegar ao servico.

## Correção
No arquivo `supabase/functions/integra-contador/index.ts`, na funcao que monta os headers do AUTENTICAPROCURADOR (linha ~287-291):

**Atual:**
```typescript
const apiHeaders: Record<string, string> = {
  "Authorization": `Bearer ${bearerToken}`,
  "Content-Type": "application/json",
  "Accept": "application/json",
};
```

**Corrigido:**
```typescript
const apiHeaders: Record<string, string> = {
  "Authorization": `Bearer ${bearerToken}`,
  "Content-Type": "application/json",
  "Accept": "application/json",
  "jwt_token": "",
  "autenticar_procurador_token": "",
};
```

Ambos os headers devem ser enviados com valor vazio, conforme a documentacao oficial do SERPRO que voce colou:
- `jwt_token`: vazio (nao precisa preencher)
- `autenticar_procurador_token`: vazio (nao precisa preencher)

## Arquivo
- `supabase/functions/integra-contador/index.ts` -- alterar ~3 linhas

## Resultado esperado
O gateway SERPRO para de rejeitar com `jwt_token inválido` e a requisicao chega ao servico AUTENTICAPROCURADOR, que validara o XML assinado.

