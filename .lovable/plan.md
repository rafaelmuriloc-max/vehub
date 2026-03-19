

# Corrigir autenticação OAuth2 — usar fetch normal (sem mTLS)

## Problema
A chamada de autenticação OAuth2 usa `requestWithFetchHttp1` com certificado mTLS, mas o `curl` que funciona não usa certificado cliente — apenas `Authorization: Basic` + `grant_type=client_credentials`. O gateway SERPRO retorna 404 quando recebe mTLS na rota de autenticação.

## Solução

### Arquivo: `supabase/functions/integra-contador/index.ts`

1. **Trocar a chamada de auth de `requestWithFetchHttp1` para `fetch` padrão** (linhas 135-149):
   - Usar `fetch(SERPRO_AUTH_URL, { method: "POST", headers: {...}, body: "grant_type=client_credentials" })` sem certificado cliente
   - Manter mTLS apenas para as chamadas à API de serviço (que exigem certificado digital)

2. **Ajustar o parsing da resposta** (linhas 151-167):
   - Adaptar de `authResponse.bodyText` / `authResponse.status` para `await response.text()` / `response.status` do fetch nativo

3. **Manter mTLS nas chamadas de serviço** — a chamada real à API continua usando `requestWithFetchHttp1` com certificado

## Resultado esperado
A autenticação OAuth2 passará igual ao `curl` (sem certificado cliente), e apenas as chamadas à API usarão mTLS com o e-CNPJ.

