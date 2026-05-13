## Objetivo
Permitir gravar e enviar mensagens de áudio no chat (estilo WhatsApp), além de também aceitar upload de arquivos de áudio existentes.

## UI — `src/components/chat/ChatInput.tsx`

1. Adicionar botão de microfone ao lado do botão de enviar:
   - Quando o campo de texto estiver **vazio**, exibe ícone `Mic` (gravar).
   - Quando há texto digitado, mantém o ícone `Send` atual.
2. Ao clicar no microfone, inicia gravação via `MediaRecorder` (`navigator.mediaDevices.getUserMedia({ audio: true })`):
   - Mostra barra de gravação no lugar do textarea: ícone vermelho pulsante, timer `mm:ss`, botão ✖ (cancelar) e botão ✓ (enviar).
   - Formato preferido: `audio/webm;codecs=opus` (fallback `audio/mp4`).
3. Ao confirmar, gera `File` (`audio_<timestamp>.webm`) e chama `onSendMedia(file, 'audio')`.
4. Adicionar opção "Áudio" no popover de anexos (ícone `Mic`) para upload de arquivo de áudio existente (`accept="audio/*"`).

## Tipos / fluxo — `src/components/chat/ChatInput.tsx`, `MessageArea.tsx`, `src/pages/Chat.tsx`

Estender o tipo de `onSendMedia` de `'image' | 'video' | 'document'` para incluir `'audio'` em todos os pontos da cadeia.

## Upload — `src/pages/Chat.tsx` (`sendMedia`)

Lógica atual de upload para o bucket `chat-media` já cobre qualquer mídia. Apenas:
- Mapear `type='audio'` para `messageType='whatsapp_audio'` ao chamar a edge function.
- Sanitizar nome do arquivo (já há padrão no projeto).

## Backend — `supabase/functions/whatsapp-send-media/index.ts`

Adicionar branch `audio` no envio:

- **Meta API (janela 24h aberta):**
  ```json
  { "messaging_product":"whatsapp", "to":<phone>, "type":"audio", "audio":{ "link": <mediaUrl> } }
  ```
  (áudio na Meta API não suporta caption.)
- **Evolution API (fora da janela):** endpoint `POST /message/sendWhatsAppAudio/{instance}` com payload:
  ```json
  { "number": <phone>, "audio": <mediaUrl> }
  ```
- Para inclusão na tabela `chat_messages`: `message_type='whatsapp_audio'`, `media_url=<url do bucket>`, `content='audio'`.

## Renderização

`MessageBubble.tsx` já trata `whatsapp_audio` com tag `<audio controls>`. Sem mudanças.

## Permissões

A gravação exige permissão de microfone do navegador. Se negada, exibir toast "Permita o acesso ao microfone".

## Não muda
- RLS, schema do banco e bucket `chat-media` (já público) permanecem como estão.
- Lógica de auto-atribuição (`ensureAssignedToMe`) já cobre `sendMedia`.
