

# Help Desk: abas, atribuição e fechamento de chamados

## Visão geral
Transformar o chat em sistema de help desk com status (aberto/fechado), atribuição a usuário, 3 abas de visualização e botão de fechar chamado.

## 1. Migração de banco de dados

Adicionar 2 colunas à tabela `chat_conversations`:
- `status text NOT NULL DEFAULT 'open'` — valores: `open`, `closed`
- `assigned_to uuid` — usuário responsável pelo chamado
- `closed_at timestamptz` — data de fechamento

Atualizar conversas existentes: setar `assigned_to = created_by` para todas as conversas atuais.

Adicionar RLS policy para permitir que qualquer usuário autenticado veja conversas (aba "Todos" precisa ver conversas de outros). Atualmente a policy de SELECT exige participação — precisamos de uma policy adicional para autenticados verem conversas abertas.

## 2. ConversationList — 3 abas (`src/components/chat/ConversationList.tsx`)

Adicionar Tabs (usando componente existente) acima da busca:
- **Chat** (default): conversas onde `assigned_to === user.id` e `status === 'open'`
- **Atendidos**: conversas onde `assigned_to === user.id` e `status === 'closed'`
- **Todos**: todas as conversas com `status === 'open'` (de todos os usuários)

Props novas: `activeTab`, `onTabChange`.

## 3. Chat.tsx — carregar por aba (`src/pages/Chat.tsx`)

- Novo estado `activeTab: 'mine' | 'closed' | 'all'`
- `loadConversations` recebe o tab e ajusta a query:
  - `mine`: buscar conversas com `assigned_to = user.id` e `status = 'open'` (direto da tabela, sem filtrar por participações)
  - `closed`: buscar conversas com `assigned_to = user.id` e `status = 'closed'`
  - `all`: buscar todas as conversas com `status = 'open'`
- Passar `activeTab` e `onTabChange` para ConversationList

## 4. Botão "Fechar Chamado" no MessageArea (`src/components/chat/MessageArea.tsx`)

- Nova prop: `onCloseTicket`, `isClosed`
- No header, ao lado do nome, mostrar botão "Fechar Chamado" (ícone CheckCircle)
- Se `isClosed`, mostrar badge "Fechado" e desabilitar input
- Ao clicar: `update chat_conversations set status='closed', closed_at=now() where id=...`

## 5. Chat.tsx — handler de fechamento

- Função `closeTicket` que faz o update e recarrega conversas
- Passar `onCloseTicket` e `isClosed` para MessageArea
- Desabilitar envio de mensagens em conversas fechadas

## 6. Atribuição na criação

- No `NewConversationDialog`, ao criar conversa, setar `assigned_to = user.id`
- Conversas criadas via webhook (WhatsApp) já usam `created_by` que será o default para `assigned_to`

## Arquivos modificados
- **Migração SQL**: adicionar colunas + policy
- `src/pages/Chat.tsx`: lógica de abas, query condicional, closeTicket
- `src/components/chat/ConversationList.tsx`: UI das 3 abas
- `src/components/chat/MessageArea.tsx`: botão fechar + estado fechado
- `src/components/chat/NewConversationDialog.tsx`: setar assigned_to

