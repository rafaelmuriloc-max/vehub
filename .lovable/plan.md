## Problema

Quando uma atividade envia uma mensagem de template do WhatsApp com cabeçalho de documento (PDF), o documento chega normalmente no WhatsApp do cliente, mas no chat interno apenas o texto aparece — o PDF some. A "segunda mensagem com o segue" é exatamente esse caso: foi enviada com header de documento, mas o registro em `chat_messages` ficou só com o texto renderizado.

## Causa

No fluxo multi-send (`src/lib/sendActivityWhatsApp.ts`), a edge `whatsapp-send` é chamada uma vez por documento, passando `chatPreview` (texto renderizado) mas **sem informar a URL/tipo do anexo**. Em `supabase/functions/whatsapp-send/index.ts` (linha 282), o insert em `chat_messages` salva apenas `content`, sem `media_url` nem ajustar `message_type`. Por isso o `MessageBubble` não tem o que renderizar como documento.

## Solução

Propagar a URL do PDF (signed URL já gerada para o Meta) e o tipo de mídia até o registro do chat.

### 1. `src/lib/sendActivityWhatsApp.ts` (multi-send)
No loop de documentos, incluir no body da invocação:
- `mediaUrl: signedData.signedUrl`
- `mediaType: 'document'`
- `mediaFilename: fileName` (usado como `content` para exibir o nome do arquivo na bolha)

### 2. `supabase/functions/whatsapp-send/index.ts`
- Aceitar `mediaUrl`, `mediaType`, `mediaFilename` no body.
- Quando presentes, no insert em `chat_messages`:
  - `message_type: \`whatsapp_${mediaType}\`` (ex.: `whatsapp_document`)
  - `media_url: mediaUrl`
  - `content: mediaFilename || chatPreview || messageContent` (o `MessageBubble` usa `content` como nome do arquivo no `DocumentMessage`)
- Quando não houver mídia, manter o comportamento atual.

### Observação sobre a mensagem "segue"
Para mensagens de template **sem** cabeçalho de documento (caso da primeira "segue"), continua certo só ter texto. Apenas o segundo envio (com header de documento) ganha o anexo na bolha do chat.

### Backfill (opcional)
Não incluído nesta proposta. Se desejar, posso, depois da correção, popular retroativamente `media_url` das mensagens de hoje cruzando `whatsapp_logs.template_params` (parameter `document.link`) com `chat_messages` por janela temporal — me avise se quiser.

## Fora de escopo
- Mudanças no `MessageBubble` (já suporta `whatsapp_document`).
- Mensagens de imagem/vídeo em templates (mesmo padrão poderia ser aplicado depois, se necessário).
