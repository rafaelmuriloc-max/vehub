

# Adicionar botão "Voltar" na tela do Chat

## Problema
Na tela do chat, não há como voltar para o restante do sistema (dashboard, clientes, etc.) — especialmente no mobile, onde o header global do AppLayout foi ocultado na rota `/chat`.

## Solução
Adicionar um botão de voltar no header da lista de conversas (`ConversationList`), que navega para a página anterior ou para o dashboard (`/`).

### `src/components/chat/ConversationList.tsx`
- Aceitar nova prop `onNavigateBack?: () => void`
- No header (linha 69), adicionar um botão com ícone `ArrowLeft` antes do título "Conversas"

### `src/pages/Chat.tsx`
- Passar `onNavigateBack={() => navigate('/')}` para o `ConversationList`
- Importar `useNavigate` de `react-router-dom`

## Arquivos alterados
- `src/components/chat/ConversationList.tsx` — prop + botão voltar no header
- `src/pages/Chat.tsx` — passar callback de navegação

