## Diagnóstico

A notificação não chegou porque as mensagens recebidas pelo WhatsApp estão sendo salvas com `sender_id` igual ao usuário admin/atendente (`a9a263c4...`).

Na função `chat-notify`, a lógica atual remove o `sender_id` dos destinatários para evitar notificar quem enviou a mensagem. Como o `sender_id` da mensagem recebida está sendo preenchido com o próprio admin, o admin é removido e a função fica sem destinatários válidos.

Evidências encontradas:
- Existem 2 inscrições push no iPhone para o usuário admin.
- O trigger `chat_messages_notify` existe e está ativo.
- A Edge Function `chat-notify` está sendo acionada.
- Mensagens recentes `whatsapp_incoming` têm `sender_id` igual ao admin/atendente da conversa.

## Plano de correção

1. Ajustar `supabase/functions/whatsapp-webhook/index.ts`
   - Para mensagens recebidas do cliente (`isFromMe === false`), salvar `sender_id` como `null`.
   - Para mensagens enviadas pela empresa (`isFromMe === true`), manter `sender_id` como o usuário do sistema/admin.
   - Isso separa corretamente mensagens externas de mensagens internas.

2. Ajustar `supabase/functions/chat-notify/index.ts`
   - Manter o bloqueio de notificações para mensagens realmente enviadas pelo próprio usuário.
   - Garantir que mensagens `whatsapp_incoming`, `whatsapp_incoming_image`, `whatsapp_incoming_audio`, `whatsapp_incoming_video` e `whatsapp_incoming_document` notifiquem admins/atendente mesmo quando não houver `sender_id`.
   - Melhorar os logs para registrar: mensagem, tipo, conversa, destinatários, inscrições encontradas e resultado do envio push.

3. Reimplantar as Edge Functions afetadas
   - Deploy de `whatsapp-webhook` e `chat-notify`.

4. Validar
   - Enviar uma nova mensagem WhatsApp de teste.
   - Verificar nos logs da `chat-notify` se aparece `sent: 1` ou mais.
   - Confirmar que o iPhone recebe a notificação com o app instalado na tela inicial e permissão concedida.

## Observação

Essa correção não exige alteração de tela. O problema está no fluxo backend de identificação do remetente e seleção dos destinatários da notificação.