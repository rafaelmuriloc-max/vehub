

# Corrigir autenticação SERPRO — URL e fluxo conforme documentação oficial

## Problema identificado

A documentação oficial do Integra Contador revela que o fluxo de autenticação atual está **completamente errado** em dois aspectos:

1. **URL errada**: O código usa `https://gateway.apiserpro.serpro.gov.br/token`, mas a documentação oficial indica `https://autenticacao.sapi.serpro.gov.br/authenticate`
2. **Autenticação REQUER mTLS**: Ao contrário do que assumimos antes, a documentação oficial diz explicitamente que a autenticação **exige certificado digital e-CNPJ** (`--cert arquivo_certificado.p12:senha_certificado`)
3. **Header `Role-Type: TERCEIROS` ausente**: A documentação exige esse header na requisição de autenticação

Isso explica o erro 404 — o endpoint `/token` no gateway não é o correto para o Integra Contador.

## Solução

### Arquivo: `supabase/functions/integra-contador/index.ts`

1. **Alterar `SERPRO_AUTH_URL`** para `https://autenticacao.sapi.serpro.gov.br/authenticate`

2. **Voltar a usar `requestWithFetchHttp1` (mTLS) na autenticação** — a documentação oficial exige certificado digital na chamada de autenticação. Adicionar o header `Role-Type: TERCEIROS`.

3. **Manter o uso de `jwt_token`** na chamada à API — o código já faz isso corretamente (linhas 195-197).

### Mudanças concretas

```text
Linha 10:  SERPRO_AUTH_URL → "https://autenticacao.sapi.serpro.gov.br/authenticate"

Linhas 135-142: Trocar fetch() por requestWithFetchHttp1() com:
  - certPem/keyPem (mTLS)
  - Header "Role-Type": "TERCEIROS"
  - Header "Authorization": "Basic ..."
  - Header "Content-Type": "application/x-www-form-urlencoded"
  - body: "grant_type=client_credentials"

Linhas 144-153: Voltar a usar authResponse.bodyText / authResponse.status
```

## Resultado esperado
A autenticação usará o endpoint correto com mTLS + Role-Type, retornando `access_token` e `jwt_token` para uso nas chamadas à API.

