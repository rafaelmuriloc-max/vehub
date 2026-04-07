

# Exibir telefone ao clicar no avatar do cabeçalho da conversa

## O que será feito
Ao clicar no avatar no **cabeçalho** da área de mensagens (não na lista), um popover exibirá o número de WhatsApp do contato.

## Alterações

### 1. `src/components/chat/MessageArea.tsx`
- Adicionar prop `whatsappPhone?: string` na interface `MessageAreaProps`
- Importar `Popover`, `PopoverTrigger`, `PopoverContent`
- Envolver o `<Avatar>` do header (linha 78-83) com `Popover` + `PopoverTrigger`
- No `PopoverContent`, exibir o telefone formatado ou "Sem telefone"

### 2. `src/pages/Chat.tsx`
- Passar `whatsappPhone={activeConv?.whatsappPhone}` ao `<MessageArea>`

## Arquivos alterados
- `src/components/chat/MessageArea.tsx` — ~12 linhas
- `src/pages/Chat.tsx` — 1 linha

