

# Refatorar fluxo completo do AUTENTICAPROCURADOR na Edge Function integra-contador

## Contexto

O fluxo atual já tem a estrutura básica (gerar XML, assinar, enviar), mas ainda falha com 403 no SERPRO. A informação nova do usuário é crítica: **os headers `jwt_token` e `autenticar_procurador_token` vazios são apenas para o ambiente de simulação**. Em produção, o `jwt_token` retornado pela autenticação OAuth2 **deve ser enviado** no header do AUTENTICAPROCURADOR.

## Diagnóstico do erro atual

O código na linha 291 envia `"jwt_token": ""` no AUTENTICAPROCURADOR. Porém, em produção, o gateway SERPRO exige o `jwt_token` real obtido na autenticação OAuth2. A documentação oficial mostra:

```
Header jwt_token: eyJhbGciOiJIUzI1NiIs... (JWT válido retornado na autenticação)
```

O erro `[AcessoNegado-ICGERENCIADOR-041] HEADER jwt_token inválido` confirma: o gateway rejeita porque recebe string vazia em vez do JWT real.

## Alterações no arquivo `supabase/functions/integra-contador/index.ts`

### 1. Corrigir headers do AUTENTICAPROCURADOR (linha ~287-293)
Enviar o `jwt_token` real obtido na autenticação OAuth2, não string vazia:

```typescript
const apiHeaders: Record<string, string> = {
  "Authorization": `Bearer ${bearerToken}`,
  "Content-Type": "application/json",
  "Accept": "application/json",
  "jwt_token": jwtToken || "",           // JWT real da autenticação
  "autenticar_procurador_token": "",      // vazio nesta etapa (ainda não temos)
};
```

Isso requer passar o `jwtToken` para dentro da função `obtainProcuradorToken` (já recebe como `_jwtToken` mas não usa).

### 2. Renovação automática de token (resilência a 401)
Adicionar retry com re-autenticação quando o SERPRO retorna 401 (token expirado):

- Extrair a lógica de autenticação OAuth2 para uma função `authenticateSerpro()`
- No handler principal e no `obtainProcuradorToken`, se receber 401, chamar `authenticateSerpro()` novamente e repetir a requisição (1 retry)
- Logar quando ocorre renovação

### 3. Tratamento detalhado de erros 403
Melhorar o retorno de erro para incluir:
- O XML gerado (sem assinatura) para debug
- O stage exato onde falhou
- Código e texto da mensagem SERPRO
- Headers relevantes da resposta

### 4. Garantia de integridade XML → base64
O código atual já faz `toBase64(signedXml)` diretamente do XML assinado sem nenhuma mutação intermediária. Adicionar um assert explícito:

```typescript
const roundTrip = new TextDecoder().decode(Uint8Array.from(atob(xmlBase64), c => c.charCodeAt(0)));
if (roundTrip !== signedXml) {
  throw new Error("XML base64 round-trip mismatch");
}
```

### 5. Usar `_jwtToken` que já é parâmetro
Renomear `_jwtToken` para `jwtToken` na assinatura de `obtainProcuradorToken` e usá-lo no header.

## Resumo das mudanças

```text
Arquivo: supabase/functions/integra-contador/index.ts

1. obtainProcuradorToken: usar jwtToken real no header (não "")
2. Nova função authenticateSerpro(): extrair OAuth2 + retry em 401
3. Assert de round-trip base64 antes do envio
4. Logs detalhados em erros 403 (código SERPRO, XML debug)
5. Retry automático com re-autenticação em 401
```

## Sem mudanças em banco, UI ou outros arquivos
Toda a correção é na edge function `integra-contador`.

