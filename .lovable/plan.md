

# Envio de arquivos, imagens, vídeos, localização e contatos no Chat

## O que será feito
Adicionar ao input do chat um menu de anexos (botão "+") com opções para enviar: arquivos, imagens, vídeos, localização e contatos. Os anexos serão enviados via WhatsApp (Meta API ou Evolution API) e salvos no chat.

## Componentes de mudança

### 1. `src/components/chat/ChatInput.tsx` — Menu de anexos
- Adicionar botão "+" (Paperclip/Plus) à esquerda do textarea
- Ao clicar, abre um Popover com opções:
  - **Imagem** (Image icon) — abre file picker `accept="image/*"`
  - **Vídeo** (Video icon) — abre file picker `accept="video/*"`
  - **Arquivo** (FileText icon) — abre file picker `accept="*"`
  - **Localização** (MapPin icon) — usa `navigator.geolocation` para obter lat/lng
  - **Contato** (Contact icon) — abre dialog simples para digitar nome + telefone
- Expandir a interface `ChatInputProps`:
  - `onSendMedia: (file: File, type: 'image' | 'video' | 'document') => void`
  - `onSendLocation: (lat: number, lng: number, name?: string) => void`
  - `onSendContact: (name: string, phone: string) => void`

### 2. `src/components/chat/MessageArea.tsx` — Propagar callbacks
- Receber e repassar `onSendMedia`, `onSendLocation`, `onSendContact` para `ChatInput`

### 3. `src/pages/Chat.tsx` — Lógica de envio
- **`sendMedia`**: Upload do arquivo para bucket `chat-media`, depois invoca nova edge function `whatsapp-send-media`
- **`sendLocation`**: Invoca `whatsapp-send-media` com type `location`
- **`sendContact`**: Invoca `whatsapp-send-media` com type `contacts`

### 4. `supabase/functions/whatsapp-send-media/index.ts` — Nova Edge Function
Recebe `{ conversationId, type, mediaUrl?, fileName?, latitude?, longitude?, contactName?, contactPhone?, senderName? }`:
- **image/video/document**: Envia via Meta API (`type: image/video/document` com `link: mediaUrl`) dentro da janela 24h, ou via Evolution API (`sendMedia`) fora dela
- **location**: Envia via Meta API (`type: location` com lat/lng) ou Evolution API (`sendLocation`)
- **contacts**: Envia via Meta API (`type: contacts`) ou Evolution API (`sendContact`)
- Salva mensagem em `chat_messages` com `message_type` adequado (`whatsapp_image`, `whatsapp_video`, `whatsapp_document`, `whatsapp_location`, `whatsapp_contact`) e `media_url` quando aplicável

### 5. `src/components/chat/MessageBubble.tsx` — Renderizar novos tipos
- Adicionar cases para `whatsapp_location`: exibir link para Google Maps com ícone MapPin
- Adicionar case para `whatsapp_contact`: exibir card com nome e telefone do contato compartilhado

## Fluxo do usuário
1. Clica no "+" → escolhe tipo
2. Para mídia: seleciona arquivo → upload ao Supabase Storage → envia URL via WhatsApp
3. Para localização: browser pede permissão → obtém coordenadas → envia
4. Para contato: preenche nome/telefone em mini-dialog → envia

## Arquivos
- `src/components/chat/ChatInput.tsx` (menu de anexos)
- `src/components/chat/MessageArea.tsx` (propagar props)
- `src/components/chat/MessageBubble.tsx` (renderizar location/contact)
- `src/pages/Chat.tsx` (lógica de upload e envio)
- `supabase/functions/whatsapp-send-media/index.ts` (nova função)

