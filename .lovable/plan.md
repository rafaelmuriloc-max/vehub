## Problema

Quando o cliente responde uma mensagem no WhatsApp, a citação não chega — a mensagem entra no chat como mensagem normal, sem `reply_to_id`/`reply_to_snapshot`.

Olhando o banco, a última mensagem recebida ("Ok") veio como `conversation` puro, sem `contextInfo`. Isso indica duas possibilidades:

1. A mensagem não foi enviada como reply real (só texto digitado);
2. O Evolution está embrulhando a mensagem em `ephemeralMessage` / `viewOnceMessageV2` / `messageContextInfo`, e nosso código procura `contextInfo` apenas dentro de `extendedTextMessage`/`imageMessage`/etc — não dentro do envelope externo.

A função `whatsapp-send-text` para replies já está funcionando (a saída "teste" tem `wa_evolution_id` válido), então o problema é só no webhook ao receber o reply do cliente.

## Plano

### 1. `supabase/functions/whatsapp-webhook/index.ts`

- **Desempacotar envelopes**: antes de processar `messageObj`, desembrulhar:
  - `messageObj.ephemeralMessage?.message`
  - `messageObj.viewOnceMessage?.message`
  - `messageObj.viewOnceMessageV2?.message`
  - `messageObj.viewOnceMessageV2Extension?.message`
  - `messageObj.documentWithCaptionMessage?.message`
  
  Aplicar em loop até estabilizar para garantir que pegamos o conteúdo real.

- **Ampliar busca de `contextInfo`**: além de procurar dentro de cada `*Message.contextInfo`, também olhar:
  - `messageObj.messageContextInfo` (nível raiz da mensagem)
  - `data.contextInfo` (alguns webhooks Evolution colocam aqui)
  - `messageObj.extendedTextMessage.contextInfo.stanzaId` continua como principal

- **Logar a detecção**: adicionar `console.log("Reply detection:", { quotedStanzaId, foundOriginal: !!original })` para confirmar via Edge Logs no próximo teste real do usuário.

- **Snapshot fallback**: quando `quotedStanzaId` existir mas não acharmos a mensagem original na base (ex: mensagem antiga sem `wa_evolution_id`), usar o conteúdo de `ctxInfo.quotedMessage` (que o próprio Evolution envia) para preencher `reply_to_snapshot` mesmo sem `reply_to_id`. Assim a citação aparece visualmente, mesmo sem link clicável.

### 2. Backfill defensivo

Para mensagens antigas (`whatsapp_outgoing`) com `wa_message_id` no formato `wamid.*` e `wa_evolution_id` nulo, não há como recuperar o ID raw do WhatsApp depois do envio (Meta não devolve), então mensagens enviadas antes deste fix não poderão ser referenciadas em replies vindos do cliente. Apenas mensagens novas enviadas via Evolution ou recebidas terão lookup completo.

### 3. Validação

Após deploy:
1. Pedir ao usuário para responder uma mensagem nova (enviada após o fix) usando a ação "Responder" no WhatsApp.
2. Conferir Edge Logs do `whatsapp-webhook` pelo log `Reply detection:` e ver se `quotedStanzaId` apareceu e foi resolvido.
3. Se `foundOriginal: false`, o snapshot fallback ainda renderiza a citação visualmente.

## Detalhes técnicos

```ts
// Unwrap envelopes
let inner: any = messageObj;
for (let i = 0; i < 5; i++) {
  const next =
    inner.ephemeralMessage?.message ||
    inner.viewOnceMessage?.message ||
    inner.viewOnceMessageV2?.message ||
    inner.viewOnceMessageV2Extension?.message ||
    inner.documentWithCaptionMessage?.message;
  if (!next) break;
  inner = next;
}
// use `inner` instead of `messageObj` from here on

// Reply detection with broader scan
const ctxInfo =
  inner.extendedTextMessage?.contextInfo ||
  inner.imageMessage?.contextInfo ||
  inner.videoMessage?.contextInfo ||
  inner.audioMessage?.contextInfo ||
  inner.documentMessage?.contextInfo ||
  inner.stickerMessage?.contextInfo ||
  inner.messageContextInfo ||
  data.contextInfo ||
  null;

const quotedStanzaId = ctxInfo?.stanzaId || null;
console.log("Reply detection:", { quotedStanzaId, hasQuotedMessage: !!ctxInfo?.quotedMessage });

if (quotedStanzaId) {
  // existing lookup by wa_evolution_id
  // if !original and ctxInfo.quotedMessage, build snapshot from quotedMessage
}
```

## Fora do escopo

- Mudar para webhook do Meta (resolveria o ID mismatch de vez, mas exige reconfig no Business Manager).
- Backfill de `wa_evolution_id` em mensagens antigas enviadas via Meta.
