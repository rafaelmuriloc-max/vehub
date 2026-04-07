

# Chat Mobile-First Responsivo

## Problemas atuais
1. O container do chat tem `h-[calc(100vh-4rem)]` mas dentro do AppLayout há padding `p-6` e um header mobile de `h-12`, causando overflow e scroll duplo
2. O botão "Voltar" na view de mensagens usa `absolute` e fica sobreposto ao header da conversa
3. Botões "Transferir" e "Fechar Chamado" no header da conversa não cabem em telas pequenas
4. As bolhas de mensagem usam `max-w-[65%]` que pode ser estreito demais em mobile
5. O container principal tem `rounded-lg border shadow-sm` que desperdiça espaço em mobile

## Plano

### 1. `src/components/AppLayout.tsx`
- Remover `p-6` do wrapper do `<Outlet>` quando a rota for `/chat`, para que o chat ocupe 100% da tela em mobile
- Alternativa: usar classe condicional `p-6 md:p-6` com exceção para chat

### 2. `src/pages/Chat.tsx`
- Alterar container principal: remover `rounded-lg border shadow-sm` em mobile, usar `h-[calc(100vh-3rem)]` em mobile (considerando header 48px) e `h-[calc(100vh)]` em desktop
- Integrar o botão "Voltar" dentro do header do `MessageArea` em vez de usar posicionamento absoluto
- Passar prop `onBack` para `MessageArea` para mobile

### 3. `src/components/chat/MessageArea.tsx`
- Aceitar nova prop `onBack?: () => void`
- Em mobile, exibir botão de voltar (seta) integrado no header, antes do avatar
- Esconder texto dos botões "Transferir"/"Fechar Chamado" em mobile, mostrar apenas ícones
- Ajustar companyNames truncate para `max-w-[200px]` em mobile

### 4. `src/components/chat/MessageBubble.tsx`
- Aumentar `max-w-[65%]` para `max-w-[80%] sm:max-w-[65%]` para melhor uso do espaço em mobile

### 5. `src/components/chat/ChatInput.tsx`
- Garantir que o input tenha `safe-area-inset-bottom` para dispositivos com notch
- Manter compacto e funcional

### 6. `src/components/chat/ConversationList.tsx`
- Garantir que ocupe `h-full` em mobile sem scroll duplo

## Arquivos alterados
- `src/components/AppLayout.tsx` — padding condicional para rota /chat
- `src/pages/Chat.tsx` — container full-height, botão voltar via prop
- `src/components/chat/MessageArea.tsx` — prop onBack, header responsivo
- `src/components/chat/MessageBubble.tsx` — max-width responsivo
- `src/components/chat/ChatInput.tsx` — safe area padding

