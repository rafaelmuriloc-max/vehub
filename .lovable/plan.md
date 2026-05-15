## Problema
Ao abrir o teclado no iOS, o container do chat fica com a altura correta (visualViewport), mas como ele usa `position: static` dentro de um `<body>` com `window.innerHeight` original, sobra um espaço enorme abaixo do input — o chat fica "encolhido" no topo da tela, e o teclado cobre apenas o vazio.

No WhatsApp o input encosta no teclado porque o container fica ancorado à área visível (visualViewport), não ao body.

## Solução
Em `src/pages/Chat.tsx`, no mobile, transformar o container raiz em `position: fixed` ancorado à área visível usando `window.visualViewport.offsetTop`/`height`:

- Estender `useVisualViewportHeight` para também devolver `offsetTop` (renomear para `useVisualViewport()` retornando `{ height, offsetTop }`).
- No mobile, aplicar:
  ```
  style={{
    position: 'fixed',
    top: offsetTop,
    left: 0,
    right: 0,
    height: viewportHeight,
    paddingTop: 'env(safe-area-inset-top)',
  }}
  ```
- Manter `md:h-screen` no desktop (sem style fixed) — usar prop condicional.

Isso faz o chat "grudar" no visualViewport: quando o teclado sobe, o container desce/encolhe junto e o input fica logo acima do teclado, sem gap.

## Detalhes técnicos
- `visualViewport.offsetTop` indica o quanto a viewport visual foi deslocada para baixo (em iOS quando o teclado abre + scroll por causa do input focado).
- `position: fixed` ignora o body e usa a viewport.
- O `paddingTop: safe-area` continua válido para o notch.

## Fora de escopo
- Layout desktop e popup mantêm comportamento atual.