# Corrigir renderização de arquivos enviados (outgoing) no chat

## Problema
Arquivos enviados ao contato (PDF/imagem/áudio/vídeo) — seja pelo chat normal, seja pela nova solicitação de tarefa — chegam de volta pelo webhook do WhatsApp e são gravados em `chat_messages`, mas com `message_type = 'whatsapp_outgoing'` (sem a variante de mídia). O `MessageBubble` deriva o `mediaKind` removendo `whatsapp_(incoming_)?` do tipo; para `whatsapp_outgoing` isso resulta em `outgoing`, que não casa com nenhum case do `switch` (`image | video | audio | document`) e o `renderMedia` retorna `null`. Resultado: aparece só o nome do arquivo como texto, sem ícone/preview/download.

Mensagens de texto outgoing renderizam normalmente (não dependem do switch de mídia), por isso só o arquivo está com problema.

## Correção
Em `supabase/functions/whatsapp-webhook/index.ts`, quando `isFromMe` for `true` e houver `mediaKey`, gravar o `messageType` no mesmo padrão usado pelo `sendMedia` do chat (`whatsapp_image`, `whatsapp_video`, `whatsapp_audio`, `whatsapp_document`) em vez de colapsar tudo para `whatsapp_outgoing`.

Mudanças exatas no bloco de detecção (~linhas 100-124):

```text
imageMessage    → isFromMe ? 'whatsapp_image'    : 'whatsapp_incoming_image'
videoMessage    → isFromMe ? 'whatsapp_video'    : 'whatsapp_incoming_video'
audioMessage    → isFromMe ? 'whatsapp_audio'    : 'whatsapp_incoming_audio'
documentMessage → isFromMe ? 'whatsapp_document' : 'whatsapp_incoming_document'
stickerMessage  → isFromMe ? 'whatsapp_image'    : 'whatsapp_incoming_image'
```

Texto outgoing continua como `whatsapp_outgoing` (não é mídia, não muda nada).

Atualizar também a checagem do bloco de transcrição de áudio (linha ~590) para incluir o novo tipo:
- `messageType === 'whatsapp_incoming_audio' || messageType === 'whatsapp_audio'`
(remove `whatsapp_outgoing_audio` que nunca é gerado).

## Por que isso resolve

- `MessageBubble.mediaKind` extrai `whatsapp_(incoming_)?` → para `whatsapp_document` vira `document`, casa com o `case 'document'` e renderiza `<DocumentMessage />`. Idem para image/video/audio.
- Mensagens já existentes com tipo `whatsapp_outgoing` + `media_url` continuarão renderizando como texto. Como são poucas (apareceram após a feature recente), aceitamos não migrar — usuário pode pedir reenvio se necessário. Se preferir, podemos adicionar uma migration para corrigir retroativamente baseando-se em `media_url IS NOT NULL` e palpite por extensão do `content`.

## Arquivos afetados

- `supabase/functions/whatsapp-webhook/index.ts` (uma única região editada)

Sem mudanças de schema, sem novas Edge Functions, sem novos secrets.
