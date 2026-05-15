## Objetivo
No mobile, ao manter pressionada a bolha por 2s, abrir um menu flutuante no estilo iOS/WhatsApp: cartão branco arredondado, opções empilhadas verticalmente com ícone à esquerda e rótulo grande à direita, item destrutivo "Apagar" em vermelho, separador antes dele. Centralizado horizontalmente próximo da bolha, com fundo escurecido (overlay) cobrindo o restante da tela.

## Mudanças em `src/components/chat/MessageBubble.tsx`

1. **Remover o `DropdownMenu` no mobile** e manter apenas no desktop (já controlado por `isMobile`). No desktop o comportamento atual segue intacto.

2. **Criar componente local `MobileActionSheet`** (dentro do mesmo arquivo) renderizado via portal (`createPortal` do `react-dom`) quando `isMobile && menuOpen`:
   - `<div>` overlay fixed inset-0 com `bg-black/30 backdrop-blur-sm` e `onClick={close}`.
   - `<div>` cartão centralizado horizontalmente, `position: fixed`, posicionado verticalmente em relação à bolha (usar `getBoundingClientRect` da bolha guardada via `ref`; se não couber abaixo, posicionar acima). `min-w-[260px] max-w-[320px] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden`.
   - Cada item: `<button>` `flex items-center justify-between w-full px-4 py-3.5 text-base text-left hover:bg-black/5 active:bg-black/10` com rótulo à esquerda e ícone à direita (Reply/Forward/Pencil/Trash2/Ban), separador `border-t border-black/10` entre eles. "Apagar para todos" em `text-destructive` precedido de divisor mais grosso.
   - Ordem dos itens: Responder, Encaminhar, Editar (se `canEdit`), Apagar só para mim, Apagar para todos (se `canDeleteForAll`).
   - Animação simples de entrada via classes Tailwind (`animate-in fade-in zoom-in-95`).

3. **Posicionamento**:
   - Após `setMenuOpen(true)`, em `useLayoutEffect` calcular `rect` da bolha, decidir top/bottom (preferir abaixo; se faltar espaço usar acima), guardar em estado `{ top, side }`.
   - Centralizar horizontalmente com `left: 50%; transform: translateX(-50%)`.

4. **Fechar**:
   - Ao clicar em qualquer item ou no overlay, `setMenuOpen(false)`.
   - Travar scroll do body enquanto aberto (`document.body.style.overflow = 'hidden'` em `useEffect`).

5. **Acessibilidade**:
   - `role="menu"` no cartão e `role="menuitem"` nos botões.
   - Botão "Cancelar" não é necessário — o overlay clicável basta (igual WhatsApp).

## Detalhes técnicos
- Reaproveitar o ref já passado pelo pai (`bubbleRef`) — adicionar um `useRef` interno que guarda o nó da bolha (combinar com o ref externo via callback).
- Sem novas dependências.
- `createPortal(node, document.body)`.

## Fora de escopo
- Barra de reações com emojis acima da bolha (presente no print do WhatsApp). Pode ser próximo passo, mas não foi pedido.
- Mudanças no comportamento desktop.
