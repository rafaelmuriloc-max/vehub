## Diagnóstico

A sincronização do Simples Nacional roda no `simples-nacional-sync`, que chama o `integra-contador` via `supabase.functions.invoke`. Esse invoke usa o `SERVICE_ROLE_KEY` como `Authorization: Bearer ...`.

O `integra-contador` (linhas 490–505) valida o token como **token de usuário** com `supabase.auth.getClaims(token)`. O service-role key não tem claims de usuário → retorna **401 "Token inválido"**.

Os logs confirmam: dezenas de respostas `401` em `/integra-contador` na hora da sincronização (12:50), e o sync registra "Failed to send a request to the Edge Function" para todos os PA/cliente. Por isso nenhum competência foi populada (tudo "Em aberto", sem RBT12/valor DAS).

## Correção

Adicionar um **bypass de autenticação server-to-server** em `integra-contador`: se o `Authorization` recebido for igual ao `SUPABASE_SERVICE_ROLE_KEY`, pular `getClaims` e seguir o fluxo (usar `serviceClient` para carregar `clients`/`company_settings`).

### Mudanças

1. `supabase/functions/integra-contador/index.ts` (bloco ~485–520):
   - Após validar que existe header `Bearer`, comparar com `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.
   - Se for igual → marcar `isServiceCall = true`, criar `supabase` já com SERVICE_ROLE_KEY e não chamar `getClaims`.
   - Caso contrário, manter o fluxo atual (validação de usuário).
   - O restante da função (carregamento de cliente, certificado, mTLS, SERPRO) permanece idêntico — já usa `serviceClient` para storage.

2. Nenhuma alteração necessária em `simples-nacional-sync` — o `invoke` já envia o service key automaticamente.

3. Nenhuma alteração de schema, UI ou outras edge functions.

### Validação

- Após deploy, disparar manualmente a sincronização de 1 empresa (botão "Atualizar esta empresa") e checar:
  - Logs de `integra-contador` sem 401.
  - Logs de `simples-nacional-sync` sem "Failed to send a request".
  - Linha em `simples_nacional_competencias` populada com `valor_das`, `rbt12`, `numero_das`, PDF.

### Riscos

- Bypass restrito a chamadas que apresentem exatamente o `SERVICE_ROLE_KEY` — que só roda no servidor; nenhum cliente browser tem acesso a essa chave. Sem impacto de segurança.
