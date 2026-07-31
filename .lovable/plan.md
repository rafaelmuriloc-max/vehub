## Diagnóstico

Os logs da função `whatsapp-send-text` mostram, em todas as tentativas de hoje (18:05–18:08):

```text
ERROR Meta API error: 401 {"error":{"message":"Authentication Error","code":190,"type":"OAuthException"}}
```

O token da API oficial da Meta está expirado/inválido. No mesmo período, um envio pela Evolution API funcionou (`Evolution API send success`), ou seja, o número da ALPHA GYM está correto.

## Decisão

Passar a enviar **todas as mensagens pela Evolution API**, removendo a Meta do caminho de envio.

## Alterações

1. `supabase/functions/whatsapp-send-text/index.ts`
   - Remover o ramo da Meta (janela de 24h, `graph.facebook.com`, retry transitório e fallback).
   - Sempre resolver o número com `resolveEvolutionNumber` e enviar por `POST /message/sendText/{instance}`.
   - Manter assinatura do remetente, marcador VHUB, `quoted` para respostas, e gravação em `chat_messages` com `wa_evolution_id`.
   - Erros: número sem WhatsApp → `ok:false` com mensagem específica; falha de conexão → `transient:true`.

2. `supabase/functions/whatsapp-send-media/index.ts`
   - Mesmo tratamento: sempre `POST /message/sendMedia/{instance}` (imagem, vídeo, documento, áudio), sem chamada à Meta.

3. `supabase/functions/whatsapp-send/index.ts`
   - Usado por automações (guias, templates). Enviar sempre pela Evolution:
     - Texto → `sendText`; mídia/documento → `sendMedia` (caminho já existente com `forceEvolutionDocument`, que passa a ser o padrão).
     - Envios que hoje usam `type: "template"` da Meta passam a ser enviados como texto simples pela Evolution (o corpo do template já é montado no app).
   - Continuar registrando em `whatsapp_logs` com `status` e `wamid` = `key.id` da Evolution.

4. `src/pages/Chat.tsx`
   - Mostrar a causa real vinda de `data.error` (ex.: número sem WhatsApp, instância desconectada) em vez do texto genérico.

## Observações técnicas

- Os secrets `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` deixam de ser usados no envio; o webhook de recebimento da Meta não é alterado nesta etapa.
- A limitação da Meta de não enviar para o próprio número deixa de existir; a dependência passa a ser a instância Evolution estar conectada.
