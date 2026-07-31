---
name: WhatsApp Strategy
description: Todo envio de WhatsApp (texto, mídia, documentos, automações) é feito pela Evolution API
type: preference
---
Todas as mensagens de WhatsApp saem pela Evolution API. A API oficial da Meta não é mais usada para envio.

- `whatsapp-send-text`: sempre `POST /message/sendText/{instance}` (resolve o número com `/chat/whatsappNumbers`).
- `whatsapp-send-media`: sempre `sendMedia` / `sendWhatsAppAudio` / `sendLocation` / `sendContact`.
- `whatsapp-send` (automações/obrigações): texto por `sendText`; mídia/documento por `sendMedia`. Envios que antes usavam template Meta agora vão como texto (usa `text` → `chatPreview` → parâmetros do template achatados).
- Secrets `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` não são mais usados no envio (motivo da mudança: token Meta expirado, erro 401 code 190). O webhook de recebimento da Meta segue intocado.
- Dependência operacional: a instância Evolution precisa estar conectada.
