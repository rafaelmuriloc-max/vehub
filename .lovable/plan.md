

# Corrigir header fixo e espaço excessivo no input do chat mobile

## Problemas
1. **Header não fica fixo**: Ao rolar as mensagens, o cabeçalho da conversa (nome, avatar, botões) sobe junto com o scroll, sumindo da tela. Deveria ficar fixo no topo como no WhatsApp.
2. **Espaço grande entre teclado e input**: O `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` adiciona padding excessivo. Comparando com o WhatsApp (IMG_7201), o input fica colado ao teclado.

## Solução

### 1. `src/components/chat/MessageArea.tsx`
- Tornar o header fixo com `shrink-0` (já é flex column, basta garantir que o header não encolha e a área de mensagens tenha `overflow-y-auto` corretamente)
- O header na linha 80 já está correto estruturalmente — o problema é que o container pai precisa ter `overflow: hidden` e o scroll só na área de mensagens. Verificar que `h-full` + `flex flex-col` + `flex-1 overflow-y-auto` estão corretos (já estão no código atual, mas o container pai pode estar permitindo scroll geral).

### 2. `src/components/chat/ChatInput.tsx`
- Reduzir o padding bottom: trocar `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` por `pb-[env(safe-area-inset-bottom,0px)]` — o `p-3` já dá padding suficiente, o pb extra é redundante e cria o espaço excessivo.

### 3. `src/pages/Chat.tsx`
- Garantir que o container do chat em mobile use `100dvh` (dynamic viewport height) em vez de `100vh`, para que o teclado virtual seja considerado: `h-[calc(100dvh-3rem)]`

## Arquivos alterados
- `src/components/chat/ChatInput.tsx` — reduzir padding bottom (~1 linha)
- `src/pages/Chat.tsx` — usar `dvh` no height (~1 linha)
- `src/components/chat/MessageArea.tsx` — garantir header com `shrink-0` (~1 classe adicionada)

