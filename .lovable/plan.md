## Diagnóstico

Os logs da função `whatsapp-send-text` mostram, em todas as tentativas de hoje (18:05–18:08):

```text
ERROR Meta API error: 401 {"error":{"message":"Authentication Error","code":190,"type":"OAuthException"}}
```

Ou seja: o token de acesso da API oficial da Meta (`WHATSAPP_ACCESS_TOKEN`) está expirado/inválido.

No mesmo período, um envio pela Evolution API funcionou normalmente (`Evolution API send success`). Portanto o número da ALPHA GYM (5547999558898) está correto e tem WhatsApp — o problema não é o número.

Por que falha em vez de cair no plano B: hoje o código só faz fallback para a Evolution quando o erro da Meta é **transitório** (5xx, `is_transient`, code 2). O erro 190 é classificado como permanente, então a função devolve `ok:false` e o chat mostra "Verifique o número e tente novamente" — mensagem enganosa.

## Correções

1. `supabase/functions/whatsapp-send-text/index.ts`
   - Tratar erros de autenticação/autorização da Meta (HTTP 401/403 ou `error.code` 190/10/200/(4xx de token)) como "provedor indisponível" e **fazer fallback automático para a Evolution API**, reaproveitando o mesmo bloco já existente de fallback (resolução do número + `sendText`).
   - Quando o fallback também falhar, retornar `transient:true` para erros de conexão e uma mensagem de erro específica (auth vs número inexistente) no campo `error`.
2. Aplicar o mesmo tratamento em `supabase/functions/whatsapp-send-media/index.ts` e `supabase/functions/whatsapp-send/index.ts`, que compartilham a mesma lógica Meta-primeiro (verificar e alinhar).
3. `src/pages/Chat.tsx`
   - Exibir a causa real vinda de `data.error` (ex.: "Número sem WhatsApp", "Falha de autenticação no provedor") em vez do texto genérico, mantendo o texto amigável quando não houver detalhe.

## Ação necessária fora do código

O token da Meta precisa ser renovado no painel da Meta e atualizado no secret `WHATSAPP_ACCESS_TOKEN`. Com o fallback acima, os envios voltam a funcionar via Evolution mesmo antes dessa renovação.
