# Renderizar templates do WhatsApp no chat

## Problema

Quando uma atividade de obrigação envia uma mensagem via template do WhatsApp (Meta API), o registro inserido em `chat_messages` armazena `[Template: send_output_informations_template_3_header]` como conteúdo, porque a Edge Function `whatsapp-send` só conhece o `templateName` — não o corpo final renderizado.

Resultado: o usuário vê apenas o nome do template no chat interno, não o texto que foi de fato enviado ao cliente.

## Solução

O chamador (`src/lib/sendActivityWhatsApp.ts`) já tem o corpo do template (`activity.whatsapp_message_body`) com placeholders `{{var}}` e o mapa de variáveis (`templateVars`). Vamos renderizar o texto final lá e enviá-lo para a edge function num novo campo `chatPreview`, que será usado apenas para o registro no chat (não afeta o payload enviado à Meta).

## Mudanças

### 1. `src/lib/sendActivityWhatsApp.ts`
- Criar função `renderTemplateBody(body, templateVars)` que substitui `{{var}}` pelos valores resolvidos.
- Quando enviar template, incluir `chatPreview: renderedBody` no body do POST para `whatsapp-send`. Anexar a URL do botão (se houver) ao final, em nova linha, para o usuário interno ver o link enviado.

### 2. `supabase/functions/whatsapp-send/index.ts`
- Aceitar novo campo `chatPreview` no body.
- Linha 155: trocar `const messageContent = text || (templateName ? \`[Template: ${templateName}]\` : ...)` por `const messageContent = text || chatPreview || (templateName ? \`[Template: ${templateName}]\` : ...)`.
- `whatsapp_logs.body_text` continua refletindo apenas `text` (não duplica).

## Fora de escopo
- Mensagens já existentes no histórico permanecem como estão (sem migração retroativa).
- Templates enviados manualmente fora do fluxo de obrigações (se houver) continuarão mostrando `[Template: ...]` até receberem o mesmo tratamento.
