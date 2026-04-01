

# Adicionar botão "Reabrir Chamado" em conversas fechadas

## O que será feito
Adicionar um botão "Reabrir Chamado" no rodapé das conversas fechadas (onde hoje aparece apenas "Este chamado foi encerrado") e no header. Ao clicar, o status volta para `open` e o input de mensagens é reabilitado.

## Alterações

### 1. `src/pages/Chat.tsx` — nova função `reopenTicket`
- Criar função que faz `update chat_conversations set status='open', closed_at=null where id=...`
- Exibir toast de sucesso e recarregar conversas
- Passar `onReopenTicket` como prop para `MessageArea`

### 2. `src/components/chat/MessageArea.tsx` — botão de reabrir
- Nova prop `onReopenTicket`
- No header: quando `isClosed`, mostrar botão "Reabrir Chamado" (ícone `MessageCircle`) no lugar do "Fechar Chamado"
- No rodapé: substituir o texto estático por um layout com o texto + botão "Reabrir Chamado"

## Arquivos
- `src/pages/Chat.tsx`
- `src/components/chat/MessageArea.tsx`

