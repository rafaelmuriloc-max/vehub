## Objetivo
Permitir que qualquer usuário autenticado (não só admins/criadores) consiga transferir um chamado para outro membro da equipe na tela de Chat.

## Diagnóstico
O botão "Transferir" já é renderizado para todos em `MessageArea.tsx`, mas o fluxo em `src/pages/Chat.tsx` (`openTransferDialog` + `transferTicket`) é bloqueado por RLS para usuários comuns:

1. **`profiles` (SELECT)** — só admins enxergam todos os perfis. Usuários comuns recebem lista vazia em `openTransferDialog`, então não há ninguém para selecionar.
2. **`chat_participants` (INSERT)** — política atual exige que o usuário seja o **criador** da conversa ou esteja se adicionando a si mesmo. Não permite que um participante qualquer adicione o destinatário da transferência.
3. **`chat_conversations` (UPDATE)** — já permite qualquer participante atualizar; ok desde que quem transfere também seja participante.

## Mudanças

### 1. Migration (RLS)
- **`profiles`**: adicionar policy `Authenticated can view team profiles` permitindo `SELECT` para todos os usuários autenticados (campos usados: `user_id`, `full_name`, `job_title`, `avatar_url`, `department_id`). Mantém policies existentes.
- **`chat_participants`**: substituir a policy de INSERT por uma que permita inserir quando:
  - o usuário é o criador da conversa, OU
  - está se adicionando a si mesmo, OU
  - já é participante da conversa (cobre o caso de transferência por qualquer membro).

Sem alterações em `chat_conversations` (a policy de UPDATE já cobre participantes).

### 2. Sem mudanças em código de frontend
A lógica em `Chat.tsx` já funciona; depois das policies acima, o diálogo passará a listar a equipe e a transferência completará para todos.

## Considerações
- Tornar `profiles` legível para todos os autenticados é coerente com o sistema (os usuários já se veem em chat, tarefas, etc.) e necessário para listar destinatários.
- Após a transferência, o usuário que transferiu deixa de ver o chamado na aba "Meus" (segue regra atual em `loadConversations`), comportamento já existente para admins.
