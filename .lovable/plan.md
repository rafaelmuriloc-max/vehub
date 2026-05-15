## Problema

O cabeçalho mobile (com botão de menu e título da página) está sendo renderizado por trás da barra de status do iOS quando o app é aberto como PWA standalone (modo "Adicionar à Tela de Início").

Causa: o `index.html` define `viewport-fit=cover` + `apple-mobile-web-app-status-bar-style=black-translucent`, o que faz a barra de status ficar transparente e sobreposta ao conteúdo. Mas o header sticky em `AppLayout.tsx` (`h-12` fixa, sem padding superior) não respeita `env(safe-area-inset-top)`, então fica escondido sob a barra de status.

## Correção

Em `src/components/AppLayout.tsx`, no `<header>` mobile:

- Adicionar `padding-top: env(safe-area-inset-top)` via classe utilitária inline (`style={{ paddingTop: 'env(safe-area-inset-top)' }}`).
- Manter `h-12` como altura do conteúdo do header (botão + título); o padding vai empurrar o conteúdo para baixo da barra de status.
- Aplicar a mesma lógica no header da página de Chat se necessário (verificar `src/pages/Chat.tsx`, mas Chat já tem layout próprio em 100dvh).

Também garantir que o `main` da rota `/chat` (que usa `h-[100dvh]`) não tenha problema similar — caso tenha, aplicar safe-area no topo do header interno do Chat.

## Resultado esperado

Em PWA iOS standalone, o cabeçalho aparece logo abaixo da barra de status (relógio/bateria), sem sobreposição. Em navegador normal e desktop, nada muda (`env(safe-area-inset-top)` = 0).
