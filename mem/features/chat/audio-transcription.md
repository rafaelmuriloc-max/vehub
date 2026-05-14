---
name: Audio Transcription
description: Auto-transcribes WhatsApp audios via Lovable AI Gemini
type: feature
---
Toda mensagem de áudio do chat (recebida em `whatsapp-webhook` e enviada em `whatsapp-send-media` com message_type `whatsapp_audio` / `whatsapp_incoming_audio` / `whatsapp_outgoing_audio`) dispara fire-and-forget para a edge function `whatsapp-transcribe-audio`.

Fluxo: function baixa o áudio do `media_url`, envia base64 ao Lovable AI Gateway (`google/gemini-2.5-flash`) com `input_audio` e grava `transcription` + `transcription_status` (`pending|processing|done|failed|unsupported`) em `chat_messages`.

UI: `MessageBubble` exibe spinner durante `processing`, texto com ícone Sparkles em `done`, e botão "tentar novamente" em `failed`. Realtime UPDATE em `chat_messages` (Chat.tsx) propaga mudanças sem refetch. Idioma fixo pt-BR.