

# Criar Página de Chat estilo WhatsApp

## Objetivo
Criar uma página de Chat integrada ao sistema com visual inspirado no WhatsApp: lista de conversas à esquerda e painel de mensagens à direita.

## Mudanças

### 1. Tabelas no banco (2 migrações)
- **`chat_conversations`**: `id`, `name`, `is_group`, `created_at`, `updated_at`, `created_by` (ref auth.users)
- **`chat_participants`**: `id`, `conversation_id`, `user_id`, `joined_at`
- **`chat_messages`**: `id`, `conversation_id`, `sender_id`, `content` (text), `message_type` (text/image/file), `created_at`, `read_at`
- RLS: usuários só veem conversas onde são participantes
- Realtime habilitado nas tabelas de mensagens

### 2. Nova página `src/pages/Chat.tsx`
Layout dividido em dois painéis (como WhatsApp):

**Painel esquerdo — Lista de conversas**
- Header com avatar do usuário, busca e botão "Nova conversa"
- Lista de conversas com: avatar, nome, última mensagem, horário, badge de não lidas
- Busca/filtro por nome
- Conversa ativa destacada com fundo diferente

**Painel direito — Mensagens**
- Header com nome do contato/grupo e avatar
- Área de mensagens com scroll, balões verdes (enviadas) e brancos (recebidas)
- Agrupamento por data ("Hoje", "Ontem", etc.)
- Input de mensagem na parte inferior com botão de envio
- Estado vazio quando nenhuma conversa selecionada

### 3. Componentes auxiliares
- `src/components/chat/ConversationList.tsx` — lista lateral
- `src/components/chat/MessageArea.tsx` — área de mensagens
- `src/components/chat/MessageBubble.tsx` — balão individual
- `src/components/chat/ChatInput.tsx` — input com envio
- `src/components/chat/NewConversationDialog.tsx` — dialog para iniciar conversa (seleciona usuários do sistema)

### 4. Realtime com Supabase
- Subscribe no canal `chat_messages` para receber mensagens em tempo real
- Atualizar lista de conversas quando nova mensagem chegar
- Marcar mensagens como lidas ao abrir conversa

### 5. Integração no app
- Adicionar rota `/chat` em `App.tsx`
- Adicionar item "Chat" no `AppSidebar.tsx` com ícone `MessageCircle`
- Página usa `h-[calc(100vh-theme(spacing.16))]` para ocupar toda a altura sem scroll externo

### Detalhes técnicos
- Cores dos balões: enviado `bg-[#DCF8C6]`, recebido `bg-white` (tema claro do WhatsApp)
- Fundo da área de mensagens com padrão sutil (cor `bg-[#ECE5DD]`)
- Painel lateral com largura fixa ~350px, mensagens ocupam o restante
- Scroll automático para última mensagem ao abrir conversa ou receber nova
- Timestamps formatados com `date-fns` (já no projeto)
- Responsivo: em mobile, mostrar apenas a lista ou as mensagens (toggle)

