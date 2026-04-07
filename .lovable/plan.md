

# Marcador oculto para evitar duplicação de mensagens enviadas

## Problema
Quando o sistema envia uma mensagem via `whatsapp-send-text` ou `whatsapp-send-media`, o WhatsApp ecoa essa mensagem de volta ao webhook (`fromMe: true`). A deduplicação atual falha porque o conteúdo assinado (`*Nome:*\nTexto`) não bate com o conteúdo salvo (`Texto`).

## Solução
Adicionar um marcador invisível (caractere Unicode zero-width space `\u200B`) ao final do texto enviado. O webhook detecta esse marcador e ignora a mensagem imediatamente.

### 1. `supabase/functions/whatsapp-send-text/index.ts`
Adicionar o marcador ao texto enviado ao WhatsApp (não ao salvo no banco):
```typescript
const VHUB_MARKER = "\u200B\u200B\u200B"; // 3 zero-width spaces
const signedText = senderName ? `*${senderName}:*\n${text}${VHUB_MARKER}` : `${text}${VHUB_MARKER}`;
```
O `text` salvo no banco continua sem o marcador.

### 2. `supabase/functions/whatsapp-send-media/index.ts`
Mesmo marcador para captions de mídia enviadas via Meta API e Evolution API (nos payloads de envio). Adicionar `VHUB_MARKER` ao caption quando houver texto.

### 3. `supabase/functions/whatsapp-webhook/index.ts`
Logo após extrair o `text` da mensagem (linha ~88), verificar se contém o marcador:
```typescript
const VHUB_MARKER = "\u200B\u200B\u200B";
if (isFromMe && text && text.includes(VHUB_MARKER)) {
  console.log("Skipping vhub-originated message (marker detected)");
  return new Response(JSON.stringify({ ok: true, skipped: "vhub_origin" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```
Isso substitui a deduplicação atual baseada em conteúdo (linhas 400-418), que pode ser removida.

### 4. `supabase/functions/whatsapp-send/index.ts`
Adicionar o mesmo marcador ao texto/template enviado pela função de envio automático de obrigações, para consistência.

## Arquivos alterados
- `supabase/functions/whatsapp-send-text/index.ts` — marcador no texto enviado (~1 linha)
- `supabase/functions/whatsapp-send-media/index.ts` — marcador em captions (~2 linhas)
- `supabase/functions/whatsapp-webhook/index.ts` — detecção do marcador e skip (~8 linhas)
- `supabase/functions/whatsapp-send/index.ts` — marcador no texto enviado (~1 linha)

