## Objetivo
Replicar o comportamento do WhatsApp no chat mobile: quando o teclado abre, o input "gruda" logo acima dele e o cabeçalho permanece visível, sem espaço vazio entre o teclado e a caixa de texto.

## Mudanças

### 1. `src/pages/Chat.tsx`
No mobile, transformar o container raiz em `position: fixed` ancorado ao `visualViewport`:

```jsx
style={
  isMobile
    ? {
        position: 'fixed',
        top: viewportOffsetTop,
        left: 0,
        right: 0,
        height: viewportHeight,
        paddingTop: 'env(safe-area-inset-top)',
      }
    : undefined
}
```

O hook `useVisualViewport` já foi estendido na iteração anterior para devolver `{ height, offsetTop }`, então só falta garantir que o `Chat.tsx` consuma `offsetTop` e aplique no `top` do container.

### 2. Verificação
- Confirmar que `useVisualViewport` está sendo importado e desestruturado corretamente em `Chat.tsx`.
- Testar no preview mobile (402x632) abrindo uma conversa e simulando foco no input.
- Garantir que `ChatPopup.tsx` (desktop popup) não seja afetado — ele usa `h-[100dvh]` e `isMobile=false`.

## Fora de escopo
- Layout desktop.
- Outros componentes do chat (MessageArea, ChatInput) já tratam scroll interno.
