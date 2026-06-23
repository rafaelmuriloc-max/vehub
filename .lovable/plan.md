
## Problema

Quando o cliente usa a função **Responder** do WhatsApp, a mensagem chega no painel mas **sem a citação** da mensagem original. No banco, mensagens `whatsapp_incoming` recentes estão todas com `reply_to_id = NULL` e `reply_to_snapshot = NULL`, mesmo quando o cliente claramente respondeu uma mensagem.

O webhook (`supabase/functions/whatsapp-webhook/index.ts`) já tem extração de reply a partir de `contextInfo.stanzaId` / `contextInfo.quotedMessage`, mas:

1. O `console.log("Webhook received:", ...)` está truncado em **500 caracteres** — não dá pra confirmar pelos logs se a Evolution está enviando o `quotedMessage` para essas mensagens (a parte interessante vem depois dos 500 chars).
2. A busca atual cobre `extendedTextMessage.contextInfo`, `imageMessage.contextInfo`, etc. e `messageContextInfo`, mas pode estar faltando algum caminho que a Evolution está usando agora (ex.: `senderKeyDistributionMessage` envelopando, `protocolMessage`, `pollUpdateMessage`, ou `contextInfo` aninhado dentro de `documentWithCaptionMessage`).
3. O lookup do original usa `wa_evolution_id = quotedStanzaId`. Para mensagens enviadas via Meta Cloud API por nós, o `wa_message_id` é o `wamid.HBg...` da Meta, mas o `wa_evolution_id` pode estar **vazio**, então mesmo se o cliente responder a uma mensagem nossa enviada via Meta, o lookup falha — e ainda não cai no fallback do `reply_to_snapshot` porque o `if (original)` é satisfeito antes (ou não, dependendo). Hoje só cai no fallback quando `original` é null, **mas** se o cliente respondeu a mensagem nossa enviada pela Meta, o stanzaId que a Evolution recebe pode ser o próprio wamid da Meta — precisa verificar.

## Solução

### 1. Diagnóstico via logs (passo curto antes do fix)
Em `supabase/functions/whatsapp-webhook/index.ts`:
- Trocar `JSON.stringify(payload).substring(0, 500)` por `substring(0, 5000)` para o log de "Webhook received" (revertível depois).
- Adicionar log explícito do `messageObj` (após o unwrap) com `JSON.stringify(messageObj).substring(0, 3000)` quando `key.fromMe === false`, para vermos a estrutura real de uma reply.
- No bloco de "Reply lookup", logar também o `wa_evolution_id` e o `wa_message_id` candidatos buscados.

Pedir ao usuário para fazer o teste (cliente respondendo uma mensagem nossa) — com os logs detalhados conseguimos identificar exatamente onde está o `quotedMessage`.

### 2. Tornar a extração mais robusta
Ainda assim, antes do retorno do diagnóstico, já vamos:

- Adicionar mais caminhos para `ctxInfo`:
  ```ts
  const ctxInfo =
    messageObj.extendedTextMessage?.contextInfo ||
    messageObj.imageMessage?.contextInfo ||
    messageObj.videoMessage?.contextInfo ||
    messageObj.audioMessage?.contextInfo ||
    messageObj.documentMessage?.contextInfo ||
    messageObj.stickerMessage?.contextInfo ||
    messageObj.contactMessage?.contextInfo ||
    messageObj.locationMessage?.contextInfo ||
    messageObj.buttonsResponseMessage?.contextInfo ||
    messageObj.listResponseMessage?.contextInfo ||
    messageObj.templateButtonReplyMessage?.contextInfo ||
    messageObj.messageContextInfo?.quotedMessage ? messageObj.messageContextInfo : null ||
    (data as any).contextInfo ||
    null;
  ```
- Buscar o original tanto por `wa_evolution_id = quotedStanzaId` **quanto** por `wa_message_id = quotedStanzaId` (com OR), para cobrir mensagens enviadas via Meta Cloud API.
- Quando a busca local não acha nenhum original mas o payload trouxe `ctxInfo.quotedMessage`, **sempre** popular o `reply_to_snapshot` a partir do quotedMessage (o fallback já existe, mas vamos garantir que `reply_to_id` fique null sem bloquear o snapshot).
- Detectar se a quoted é nossa via `ctxInfo.participant` vazio/igual ao número do escritório (`isFromUs = !participant || participant === ourNumber`) e definir `message_type` do snapshot como `whatsapp_outgoing` quando for o caso, para a bolha de citação renderizar com o estilo correto.

### 3. Validação
1. Aguardar reprodução pelo usuário (cliente responde uma mensagem).
2. Consultar `chat_messages` filtrando a `wa_message_id` correspondente — `reply_to_snapshot` deve estar preenchido.
3. Conferir na UI se a citação aparece acima do texto da resposta.
4. Depois de confirmar, reduzir o log de payload de 5000 para 500 chars novamente.

### Fora de escopo
- Não mudar a UI do `MessageBubble` (a renderização do `replySnapshot` já existe e funciona — basta os dados chegarem).
- Não mexer em envios outgoing (`whatsapp-send-text`), apenas no recebimento.
