## Objetivo

Permitir que, ao solicitar uma tarefa por dentro da conversa, o usuário escolha mensagens (texto) e arquivos/mídias (PDF, imagem, áudio, vídeo, documento) já presentes na conversa para anexar à tarefa criada.

## UX

1. No `TaskRequestForm` (painel "Solicitar tarefa"), adicionar um botão **"Selecionar da conversa"** logo acima da seção atual de Anexos.
2. Clicar abre um Dialog com a lista das mensagens da conversa atual (mais recentes no topo), cada linha com checkbox, mostrando:
   - Remetente + horário
   - Pré-visualização do conteúdo (texto truncado, ou ícone + nome para mídia)
3. Usuário marca quantas quiser, confirma. As escolhas aparecem como "chips" no formulário, junto dos arquivos manuais já existentes, com botão X para remover individualmente.
4. Submit cria a tarefa normalmente e então:
   - **Mídias selecionadas** (`message_type` whatsapp_image / document / audio / video, ou com `media_url`): baixa do bucket `chat-media`, regrava em `documents/tasks/{taskId}/{timestamp}_{nome}` e cria registro em `task_attachments` (`direction='input'`). Mantém uniformidade com o viewer existente.
   - **Mensagens de texto selecionadas**: compila em um único arquivo `mensagens-da-conversa.txt` (formato: `[hh:mm DD/MM] Remetente: conteúdo`), faz upload em `documents/tasks/{taskId}/` e cria um `task_attachments`.

## Arquivos

**`src/components/chat/MessagePicker.tsx`** (novo)
- Dialog com lista virtualizada simples + checkboxes.
- Recebe `conversationId`, busca últimas ~200 mensagens (`chat_messages` order desc, filtra `deleted_at IS NULL`).
- Resolve `sender_id → full_name` via map de profiles passado por prop ou query.
- Emite `onConfirm(selected: SelectedItem[])` — cada item: `{ id, kind: 'text'|'media', content, media_url?, file_name?, file_type?, sender_name, created_at }`.

**`src/components/chat/TaskRequestForm.tsx`**
- Nova prop opcional `conversationId?: string | null`.
- Novo state `selectedMessages: SelectedItem[]`.
- Botão "Selecionar da conversa" (visível só quando `conversationId`).
- Renderiza chips dos selecionados acima dos arquivos manuais.
- No `handleSubmit`, após inserir a task:
  - Para cada mídia: `supabase.storage.from('chat-media').download(path)` (extraído do `media_url` armazenado, que já é uma path relativa ou URL pública — implementar helper `extractChatMediaPath`), depois `upload` em `documents/tasks/{id}/...` e insert em `task_attachments`.
  - Texto: agrega tudo em uma string, cria `Blob`, upload em `documents/tasks/{id}/mensagens-da-conversa-{timestamp}.txt`, insert em `task_attachments` com `file_type='text/plain'`.
  - Reusa o tratamento de erro/`failed[]` já existente.

**`src/pages/Chat.tsx`**
- Passa `conversationId={activeConvId}` para `<TaskRequestForm>`.

## Não-mudanças

- Sem migração de schema (reusa `task_attachments` e bucket `documents`).
- Sem mudanças no viewer de tarefas (`Tasks.tsx`) — anexos aparecem automaticamente.
- Sem mudança em RLS (políticas atuais já permitem insert por `uploaded_by = auth.uid()`).