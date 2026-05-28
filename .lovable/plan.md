Os envios pela Evolution estão funcionando (a Juracy recebe no WhatsApp), mas a função `task-notify-client` só grava em `whatsapp_logs` e não cria registros em `chat_messages`. Por isso o chat interno não mostra o texto e os anexos.

O que vou fazer em `supabase/functions/task-notify-client/index.ts`:

1. Localizar/garantir a conversa do cliente
   - Buscar `chat_conversations` por `client_id` da tarefa.
   - Se não houver, buscar por `whatsapp_phone` normalizado.
   - Se ainda não existir, criar uma nova conversa com `client_id`, `whatsapp_phone`, `name` = nome do cliente e `created_by` = usuário autenticado.

2. Após cada `sendText` da Evolution com sucesso, inserir em `chat_messages`:
   - `conversation_id` da conversa,
   - `sender_id` = `user.id`,
   - `content` = `signedMessage`,
   - `message_type` = `whatsapp_outgoing`,
   - `channel` = `whatsapp`,
   - `wa_message_id` / `wa_evolution_id` = `key.id` retornado.

3. Após cada `sendMedia` com sucesso, inserir em `chat_messages`:
   - `content` = nome do arquivo,
   - `message_type` = `whatsapp_image` para imagens ou `whatsapp_document` para os demais,
   - `media_url` = URL assinada (ou caminho do arquivo, igual ao padrão usado em outros pontos do app),
   - mesmos `wa_message_id` / `wa_evolution_id`.

4. Atualizar `chat_conversations.updated_at` (e limpar `awaiting_first_reply` se aplicável) para a conversa subir no inbox.

5. Reduzir o ruído de log do `sendMedia` (não imprimir o `body` inteiro com base64 gigante; logar só status, id e erro resumido).

Não vou alterar nenhum comportamento do envio em si — apenas refletir cada envio no chat e simplificar o log. Em seguida, validamos concluindo uma nova tarefa para a Juracy e conferindo se as mensagens aparecem na conversa.