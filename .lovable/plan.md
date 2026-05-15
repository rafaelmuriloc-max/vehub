## Problema
Após adicionar `viewport-fit=cover`, o conteúdo passa por baixo da status bar do iOS, deixando o cabeçalho do chat colado no topo (e às vezes encoberto pelo notch/status bar).

## Solução
Adicionar padding de safe-area (`env(safe-area-inset-top)`) no container raiz da página de chat, em `src/pages/Chat.tsx`. Aplicar também `safe-area-inset-bottom` no input para evitar problemas similares na base.

Mudança em `src/pages/Chat.tsx`:
- No `<div>` raiz, acrescentar `style.paddingTop = env(safe-area-inset-top)` no mobile e descontar isso da altura calculada — ou mais simples: adicionar a classe utilitária com `paddingTop: 'env(safe-area-inset-top)'` e manter `height: viewportHeight`. Como o root tem `overflow-hidden` e usa flex-col, o padding-top empurra o cabeçalho para baixo da status bar e a área de mensagens (`flex-1`) ajusta sozinha.
- Manter desktop intacto (`md:h-screen`, sem padding).

## Fora de escopo
- Nenhuma mudança em outros componentes.