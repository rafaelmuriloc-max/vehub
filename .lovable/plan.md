

# Transferir chamados entre usuários

## O que será feito
Adicionar um botão "Transferir" no header da conversa que abre um dropdown/dialog para selecionar outro usuário da equipe. Ao confirmar, o `assigned_to` da conversa é atualizado e a conversa sai da lista "Chat" do usuário atual e aparece na do novo responsável.

## Alterações

### 1. `src/components/chat/MessageArea.tsx`
- Adicionar prop `onTransferTicket` e botão "Transferir" ao lado do botão "Fechar Chamado" no header
- O botão só aparece quando a conversa está aberta

### 2. `src/pages/Chat.tsx`
- Criar estado para controlar o dialog de transferência (`transferDialogOpen`)
- Carregar lista de usuários (profiles) ao abrir o dialog
- Implementar função `transferTicket(userId)` que:
  - Atualiza `chat_conversations.assigned_to` para o novo usuário
  - Atualiza `chat_participants` (adiciona o novo usuário se não for participante)
  - Mostra toast de sucesso
  - Limpa a conversa ativa e recarrega a lista
- Renderizar um `Dialog` com lista de usuários (nome + cargo) para seleção

### 3. Dialog de transferência (inline em `Chat.tsx`)
- Select/lista com os usuários disponíveis (excluindo o atual)
- Botão "Transferir" para confirmar
- Busca profiles da tabela `profiles` + `user_roles`

## Fluxo
1. Usuário abre conversa → clica "Transferir"
2. Dialog mostra lista de colegas
3. Seleciona destinatário → confirma
4. `assigned_to` é atualizado → conversa sai da lista do usuário atual

## Arquivos
- `src/components/chat/MessageArea.tsx` (~3 linhas: nova prop + botão)
- `src/pages/Chat.tsx` (~50 linhas: dialog + função de transferência)

