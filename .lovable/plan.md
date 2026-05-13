## Problema

Mensagens enviadas pelo nosso chat para o WhatsApp do cliente, quando editadas ou apagadas no painel, mudam apenas no nosso banco. No celular do contato continuam intactas, porque não chamamos a Evolution API para refletir a alteração — e nem guardamos o `id` da mensagem no WhatsApp para conseguir referenciá-la depois.

## Solução

### 1. Persistir o ID da mensagem no WhatsApp

Migration em `chat_messages`:

- `wa_message_id text` — `key.id` (Evolution) ou `messages[0].id` (Meta) retornado no envio
- `wa_remote_jid text` — `<digits>@s.whatsapp.net`

Atualizar as edge functions de envio para gravar esses campos no `insert`:

- `whatsapp-send-text`
- `whatsapp-send-media`

(O webhook `whatsapp-webhook` já recebe `key.id` em mensagens recebidas — também passamos a gravar, útil para futura referência.)

### 2. Nova edge function `whatsapp-edit-message`

Recebe `{ messageId, newText }`. Valida:

- mensagem é `whatsapp_outgoing` com `wa_message_id` preenchido
- janela ≤15 min (limite do WhatsApp)

Chama Evolution:
```
POST {EVOLUTION_API_URL}/chat/updateMessage/{instance}
{ "number": "<digits>", "key": { "remoteJid": "...@s.whatsapp.net", "fromMe": true, "id": "<wa_message_id>" }, "text": "<newText>" }
```
Se OK, atualiza `content` e `edited_at`. Se falhar, retorna erro.

### 3. Nova edge function `whatsapp-delete-message`

Recebe `{ messageId }`. Mesma validação. Chama Evolution:
```
DELETE {EVOLUTION_API_URL}/chat/deleteMessageForEveryone/{instance}
{ "id": "<wa_message_id>", "remoteJid": "...@s.whatsapp.net", "fromMe": true }
```
Se OK, marca `deleted_at` e limpa `content`/`media_url`.

### 4. Frontend (`src/pages/Chat.tsx`)

Nos handlers `editMessage` e `deleteMessageForAll`: se `channel === 'whatsapp'` e `message_type === 'whatsapp_outgoing'`, chamar a edge function correspondente **antes** de fazer o update local. Em caso de erro do Evolution, exibir toast: "Alterado no painel, mas falhou ao refletir no WhatsApp do contato (motivo: …)".

No `MessageBubble.tsx`: desabilitar "Editar" para mensagens WhatsApp passadas 15 min ou que sejam mídia (Evolution não edita mídia).

### 5. Limitações

- Edição: só texto, ≤15 min.
- Deletar para todos: WhatsApp permite até ~2 dias, depois disso a Evolution retorna erro e o painel ainda apaga localmente.
- Mensagens recebidas (`whatsapp_incoming`): Evolution não permite apagar mensagem do outro — apaga só no painel.
- Mensagens antigas sem `wa_message_id` (anteriores à migration): pula chamada e avisa via toast.

## Notas técnicas

- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` já existem como secrets.
- Index: `CREATE INDEX idx_chat_messages_wa_id ON chat_messages(wa_message_id);`
- Memória do projeto será atualizada para registrar que edit/delete em WhatsApp passam pela Evolution API.
