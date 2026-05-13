## Editar/Excluir mensagens e excluir conversas

### Funcionalidades

**Mensagens** (menu de contexto na bolha — clique direito ou botão "⋯"):
- **Editar** — só o autor, só mensagens de texto, dentro de 15min do envio. Mostra badge "editada".
- **Excluir só para mim** — oculta a mensagem apenas para o usuário atual (qualquer um pode).
- **Excluir para todos** — só o autor (ou admin). Substitui o conteúdo por "🚫 Mensagem apagada" e remove a mídia do storage.

**Conversas** (menu "⋯" no header da conversa e na lista):
- **Excluir conversa** — só admin. Apaga mensagens, participantes e a conversa em si (cascade via SQL).

### Mudanças

#### 1. Migration (banco)

`chat_messages`:
- `edited_at timestamptz` — preenchido ao editar
- `deleted_at timestamptz` — preenchido em "excluir para todos"
- `deleted_for uuid[] default '{}'` — usuários que apagaram só pra si
- Política UPDATE já existe; adicionar política **DELETE** (autor ou admin) — usada pelo "excluir para todos" via UPDATE de soft-delete; o DELETE físico fica reservado ao cascade da conversa.

`chat_conversations`:
- Adicionar política **DELETE** restrita a `has_role(auth.uid(),'admin')`.

Função `get_chat_inbox` — atualizar o sub-select do `last_message` para ignorar mensagens onde `auth.uid() = ANY(deleted_for)` e exibir "🚫 Mensagem apagada" quando `deleted_at IS NOT NULL`.

Cascade: trigger/função `delete_conversation_cascade(p_id uuid)` que apaga `chat_messages`, `chat_participants` e a conversa numa transação (SECURITY DEFINER, restrito a admin).

#### 2. Frontend

`src/components/chat/MessageBubble.tsx`:
- DropdownMenu no hover/long-press com "Editar" / "Apagar para mim" / "Apagar para todos" (condicional ao autor + janela de 15min para editar).
- Modo edição inline (textarea + Salvar/Cancelar).
- Renderizar `deleted_at` como balão neutro com ícone Ban e texto "Mensagem apagada".
- Mostrar "(editada)" em itálico após o conteúdo se `edited_at` setado.
- Filtrar mensagens onde `currentUserId ∈ deleted_for` antes de renderizar.

`src/pages/Chat.tsx`:
- Handlers `editMessage`, `deleteForMe`, `deleteForAll`, `deleteConversation`.
- `deleteForAll`: UPDATE `content='', deleted_at=now(), media_url=null` + remoção do arquivo do bucket `chat-media` quando aplicável.
- `deleteConversation`: chamar RPC `delete_conversation_cascade`; se a conversa atual for apagada, voltar para lista vazia.
- Atualizar `loadMessages` para já filtrar `deleted_for`.

`src/components/chat/ConversationList.tsx`:
- Botão "⋯" por item (visível só para admin) com ação "Excluir conversa" + AlertDialog de confirmação.

Header da conversa (em `Chat.tsx`):
- DropdownMenu com "Excluir conversa" (admin) ao lado do nome.

### Fora de escopo
- Reagir/responder mensagens, encaminhar, sincronia da exclusão para o WhatsApp (Meta API exige endpoint próprio — fica para depois).
