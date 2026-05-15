## Problema
No mobile, ao abrir o teclado dentro de uma conversa, o cabeçalho some e só reaparece após o usuário dar pinça para reduzir o zoom. Isso acontece porque o container usa `h-[100dvh]` e o iOS Safari/Chrome não reduz o viewport visual quando o teclado abre — a página fica maior que a área visível, o teclado "empurra" o topo para fora e não há scroll de página (apenas dentro da lista de mensagens).

## Solução

### 1. `index.html` — meta viewport
Atualizar a tag para sinalizar ao navegador que o teclado virtual deve redimensionar o conteúdo (Chrome Android) e impedir zoom indesejado em inputs (iOS):
```
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

### 2. `src/pages/Chat.tsx` — altura via VisualViewport
Substituir `h-[100dvh]` por uma altura controlada pelo `window.visualViewport` (que encolhe quando o teclado abre no iOS):

- Criar hook `useVisualViewportHeight()` que escuta `resize`/`scroll` do `window.visualViewport` e retorna a altura atual (fallback `window.innerHeight`).
- Aplicar `style={{ height: vh }}` no container raiz da página `/chat` no mobile; manter `md:h-screen` no desktop.
- Manter `overflow-hidden` no root e `flex-col` para que o cabeçalho (`shrink-0`) e o input fiquem fixos enquanto a área de mensagens (`flex-1 overflow-y-auto`) ocupa o espaço restante.

### 3. `MessageArea.tsx` — garantir cabeçalho sempre visível
O cabeçalho já é `shrink-0` (linha 180). Adicionar `sticky top-0 z-20` como reforço, e remover qualquer `bg-white` para usar `bg-background` (token semântico). O input do rodapé já é `shrink-0`.

## Detalhes técnicos
- `visualViewport.height` reflete a área realmente visível (descontando o teclado), diferente de `100dvh` que no iOS continua sendo a tela inteira.
- Ouvir tanto `resize` quanto `scroll` do `visualViewport` para cobrir os casos do iOS.
- Limitar a alteração à página `/chat` para não afetar outras telas.

## Fora de escopo
- Mudanças no popup (`/chat/popup`) — receberá o mesmo tratamento porque compartilha o componente.
- Comportamento desktop permanece inalterado (`md:h-screen`).