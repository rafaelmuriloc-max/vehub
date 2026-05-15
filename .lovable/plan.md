## Mudança

Em `src/components/chat/ConversationList.tsx`, dentro do bloco de cada conversa (linha ~232), adicionar uma nova linha com a prévia da última mensagem (`conv.lastMessage`) logo abaixo do nome do contato e da lista de empresas (`companyNames`).

Posição: após o `<p>` de `companyNames` (linha 237) e antes do `</div>` da coluna esquerda (linha 238).

Renderização:
- Texto truncado em uma linha (`truncate`).
- Estilo cinza (`text-muted-foreground`), `text-[12px]`, com leve negrito quando houver mensagens não lidas (igual ao tratamento já dado ao horário).
- Se a mensagem for de mídia (sem texto), mostrar rótulo amigável conforme `lastMessageType`:
  - `whatsapp_*image*` → "📷 Foto"
  - `whatsapp_*video*` → "🎥 Vídeo"
  - `whatsapp_*audio*` → "🎤 Áudio"
  - `whatsapp_*document*` → "📄 Documento"
  - `whatsapp_location` → "📍 Localização"
  - `whatsapp_contact` → "👤 Contato"
  - caso contrário → `conv.lastMessage`.

### Detalhes técnicos

1. Em `src/pages/Chat.tsx` (linha ~159), incluir `lastMessageType: conv.last_message_type || null` no objeto da conversa (o campo já é retornado pela view `get_chat_inbox`).
2. Em `src/components/chat/ConversationList.tsx`, adicionar `lastMessageType?: string | null` na `interface Conversation` e renderizar a prévia descrita acima.

Nenhuma mudança em DB ou estilos globais.
