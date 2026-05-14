## Transcrição automática de áudios do WhatsApp

Adicionar transcrição automática de toda mensagem de áudio (recebida e enviada) usando Lovable AI Gateway com Gemini, exibindo o texto abaixo do player de áudio no chat.

### 1. Banco de dados (migration)

Adicionar 2 colunas em `chat_messages`:
- `transcription` (text, nullable) — texto transcrito
- `transcription_status` (text, default `'pending'`) — `pending | processing | done | failed | unsupported`

### 2. Nova edge function `whatsapp-transcribe-audio`

- Recebe `{ message_id }`
- Busca a mensagem em `chat_messages`; valida que `message_type` é áudio (`whatsapp_incoming_audio`, `whatsapp_outgoing_audio`, `audio`) e tem `media_url`
- Marca `transcription_status = 'processing'`
- Baixa o arquivo de áudio (do Supabase Storage `chat-media` ou da URL direta)
- Converte para base64 e envia ao Lovable AI Gateway:
  - Modelo: `google/gemini-2.5-flash` (suporta áudio inline via `input_audio`)
  - System prompt: "Transcreva o áudio em português brasileiro literalmente, sem comentários."
  - Conteúdo: array com `{ type: "input_audio", input_audio: { data: <base64>, format: "ogg"|"mp3" } }`
- Salva resultado em `transcription` e marca `done` (ou `failed` com retry simples)
- Tratamento dos erros 429/402 do gateway com toast/log

### 3. Disparo automático

Modificar `whatsapp-webhook/index.ts`:
- Após inserir uma mensagem de áudio recebida, fazer fire-and-forget para `whatsapp-transcribe-audio`

Modificar `whatsapp-send-media/index.ts`:
- Após enviar áudio com sucesso e gravar em `chat_messages`, disparar a function

### 4. UI

`src/components/chat/AudioMessage.tsx`:
- Aceitar nova prop `transcription?: string | null` e `transcriptionStatus?: string`
- Renderizar abaixo do player:
  - Se `processing`: skeleton/spinner pequeno + "Transcrevendo…"
  - Se `done`: bloco discreto com ícone, texto da transcrição (collapsible se > 200 chars)
  - Se `failed`: botão "Tentar novamente" que invoca a function

`src/components/chat/MessageBubble.tsx`:
- Passar `message.transcription` e `message.transcription_status` para `<AudioMessage />`

### 5. Realtime

A página de chat já escuta `chat_messages` via realtime, então o UPDATE com `transcription` populado vai aparecer automaticamente sem mudanças adicionais.

### Detalhes técnicos

- Modelo escolhido: `google/gemini-2.5-flash` (multimodal, suporta áudio nativo, custo baixo)
- Limite prático: áudios do WhatsApp raramente passam de 5 min, ficam bem dentro do limite do Gemini
- Idioma fixo: pt-BR (sem detecção, custo menor)
- Sem fila/cron: chamada direta async; se falhar fica `failed` e o botão manual recupera
- Sem custo de novas secrets: usa `LOVABLE_API_KEY` já existente

### Fora do escopo

- Diarização de falantes (Gemini não faz; ficaria para ElevenLabs futuramente)
- Transcrição de áudios antigos em lote (pode ser adicionado depois com um botão admin)
- Tradução
