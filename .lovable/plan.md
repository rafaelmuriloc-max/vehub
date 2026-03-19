

# Corrigir URL de autenticação OAuth2 do SERPRO

## Problema
A edge function usa `https://autenticacao.sapi.serpro.gov.br/authenticate` para OAuth2, mas o curl que você compartilhou mostra que a autenticação do Integra Contador funciona diretamente em `https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/` com Basic Auth + `grant_type=client_credentials`.

O endpoint de autenticação correto para o Integra Contador é o próprio gateway, não o servidor de autenticação separado.

## Solução

### Arquivo: `supabase/functions/integra-contador/index.ts`

1. **Trocar a URL de autenticação** (linha 10):
   - De: `https://autenticacao.sapi.serpro.gov.br/authenticate`
   - Para: `https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/`

2. **Remover o header `Role-Type: TERCEIROS`** da chamada de auth (linha 142) — o gateway pode não usar esse header no mesmo formato.

3. **Manter o restante do fluxo** igual: Basic Auth com consumer key/secret, `grant_type=client_credentials`, e uso do `access_token` retornado para as chamadas subsequentes à API.

## Resultado esperado
A autenticação OAuth2 passará pelo mesmo endpoint que funciona via curl, eliminando possíveis incompatibilidades com o servidor de autenticação separado.

