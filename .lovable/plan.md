## Problema

A marcação nativa "Encaminhada" no WhatsApp do contato só aparece quando a mensagem é enviada com o `contextInfo` de forwarding do protocolo Baileys/WA-Web.

A Meta Cloud API **não expõe** essa flag — qualquer mensagem enviada por ela aparece como mensagem normal no WhatsApp do destinatário, mesmo com `is_forwarded=true` no nosso banco.

A Evolution API (que já usamos como fallback para replies) suporta enviar mensagens com `options.contextInfo.forwardingScore` e `options.contextInfo.isForwarded`, fazendo o WhatsApp do contato exibir o rótulo "Encaminhada".

Logs confirmam que o teste atual foi via Meta API: `Sending via Meta API (24h window open)`.

## Solução

Quando a mensagem for encaminhada (`isForwarded=true`), forçar o envio via Evolution API e incluir o `contextInfo` de forward.

### 1. `supabase/functions/whatsapp-send-text/index.ts`
- Quando `isForwarded === true`:
  - Pular Meta API e ir direto para o branch Evolution (já existente, hoje usado para reply fallback).
  - No payload do `/message/sendText/{instance}`, incluir:
    ```json
    "options": {
      "contextInfo": {
        "isForwarded": true,
        "forwardingScore": 5
      }
    }
    ```
- Manter persistência de `is_forwarded: true` em `chat_messages`.

### 2. `supabase/functions/whatsapp-send-media/index.ts`
- Mesma lógica: quando `isForwarded === true`, rotear via Evolution (`/message/sendMedia/{instance}` ou `/message/sendWhatsAppAudio/{instance}`) com `options.contextInfo.{isForwarded, forwardingScore}`.

### 3. Fallback
- Se Evolution não estiver configurada (variáveis ausentes), cair de volta para Meta API e gravar `is_forwarded` apenas para exibição interna (sem rótulo nativo no celular do contato). Logar aviso.

## Detalhes técnicos

- A flag `forwardingScore` (>=1) é o que faz o WhatsApp Web/Mobile exibir "Encaminhada"; valores >=5 mostram "Encaminhada várias vezes". Vamos usar `5` para coincidir com o visual da referência ("Encaminhada" simples também aceita ≥1, mas Baileys padrão é 5).
- O `VHUB_MARKER` (`\u200B\u200B\u200B`) deve continuar sendo anexado ao texto para evitar eco no webhook.
- Não há mudança de UI: o rótulo no nosso chat (já implementado) continua via `is_forwarded` da tabela.
