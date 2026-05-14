## Objetivo
Permitir renomear manualmente o nome do contato/conversa diretamente no chat, e impedir que o webhook do WhatsApp sobrescreva esse nome com o `pushName` recebido posteriormente.

## Mudanças

### 1. Banco
Migration adicionando flag em `chat_conversations`:
```sql
ALTER TABLE public.chat_conversations
  ADD COLUMN name_locked boolean NOT NULL DEFAULT false;
```

### 2. Webhook (`supabase/functions/whatsapp-webhook/index.ts`)
Ao atualizar `name` a partir do `pushName` (linhas 292–294 e 432–435), só fazê-lo se `existingConvData.name_locked !== true`. Selecionar a coluna no `select` de leitura.

### 3. UI — `src/components/chat/MessageArea.tsx`
- Adicionar prop `onRenameConversation?: (newName: string) => void`.
- Renderizar um ícone `Pencil` (lucide-react) ao lado do `<p>{conversationName}</p>` (linha 120). Ao clicar, abre um `Dialog` simples com `Input` pré-preenchido + botões Cancelar/Salvar.
- Mostrar o ícone para qualquer usuário autenticado (a RLS de UPDATE em `chat_conversations` já restringe a participantes).

### 4. `src/pages/Chat.tsx`
- Implementar `handleRenameConversation(name: string)`: `update({ name, name_locked: true }).eq('id', activeConvId)`, com feedback via toast e refresh local da lista.
- Passar para `<MessageArea onRenameConversation={...} />`.

## Fora de escopo
- Sem alterações na lista de conversas; ela reflete o novo nome via realtime.
- Sem botão de "destravar" — caso futuro, basta editar.