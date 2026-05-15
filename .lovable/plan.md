## Problema
Mesmo com `position: fixed` + `visualViewport.offsetTop/height` no container do Chat, sobra um espaço grande entre o input e o teclado no iOS (visível na captura). No WhatsApp não acontece porque o input fica colado no topo do teclado.

Causas prováveis:
1. iOS Safari não respeita `interactive-widget=resizes-content` (apenas Chromium suporta). O layout viewport não encolhe — só o `visualViewport`.
2. Quando o usuário foca o `<textarea>` dentro de um `position: fixed`, o iOS faz scroll automático para tentar centralizar o input, deslocando `visualViewport.offsetTop` de forma instável.
3. `pb-[calc(env(safe-area-inset-bottom,0px)+16px)]` no `ChatInput` adiciona padding fixo na base do input (16-50px) que não some com o teclado aberto.

## Solução

Trocar a estratégia atual por uma que separa o input do container, igual ao WhatsApp Web/PWA:

### 1. `src/pages/Chat.tsx`
Voltar o container do Chat no mobile para layout simples, sem `position: fixed`:
```jsx
className="flex flex-col w-full overflow-hidden bg-background h-[100dvh] md:h-screen"
style={{ paddingTop: 'env(safe-area-inset-top)' }}
```
Remover o uso de `viewportOffsetTop`/`viewportHeight` no container raiz.

### 2. `src/components/chat/MessageArea.tsx`
Envolver o `ChatInput` em um wrapper que se desloca para cima conforme o teclado abre, usando `transform: translateY(-keyboardInset)`:
```jsx
const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);
<div
  className="shrink-0"
  style={{ transform: `translateY(-${keyboardInset}px)`, transition: 'transform 0s' }}
>
  <ChatInput ... />
</div>
```
Adicionar também `padding-bottom: keyboardInset` na área de scroll das mensagens para que a última mensagem não fique escondida pelo input deslocado.

### 3. `src/components/chat/ChatInput.tsx`
Remover o `pb-[calc(env(safe-area-inset-bottom,0px)+16px)]` quando o teclado está aberto. Substituir por:
```jsx
className="... pb-[calc(env(safe-area-inset-bottom,0px)+8px)]"
```
e zerar via prop `keyboardOpen` quando `keyboardInset > 0` (sem padding extra).

### 4. Hook
Manter `useVisualViewport()` retornando `{ height, offsetTop }`. Usar em `MessageArea` para calcular `keyboardInset`.

## Por que funciona
- O container ocupa toda a tela com `100dvh`. O teclado sobrepõe a parte de baixo.
- O `translateY` move o input para cima pelo exato número de pixels que o teclado cobre, deixando-o colado no topo do teclado.
- O `padding-bottom` no scroll mantém a última mensagem visível.
- Sem `position: fixed`, o iOS para de fazer scroll automático maluco.

## Fora de escopo
- Layout desktop (continua usando `md:h-screen`).
- ChatPopup (já usa `h-[100dvh]`).
