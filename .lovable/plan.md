## Objetivo
No mobile, substituir a seta no canto superior direito da bolha de mensagem por um gesto de toque longo (2 segundos) para abrir o menu de ações, igual ao WhatsApp. No desktop, manter o comportamento atual (seta visível ao passar o mouse).

## Mudanças em `src/components/chat/MessageBubble.tsx`

1. **Detectar mobile** com o hook `useIsMobile()` (já existente em `src/hooks/use-mobile.tsx`).

2. **Estado controlado do DropdownMenu**: adicionar `const [menuOpen, setMenuOpen] = useState(false)` e converter `<DropdownMenu>` para controlado (`open={menuOpen} onOpenChange={setMenuOpen}`).

3. **No mobile**:
   - Esconder o botão da seta (`ArrowDownToLine`) — renderizar apenas quando `!isMobile`.
   - Adicionar handlers `onTouchStart` / `onTouchEnd` / `onTouchMove` / `onTouchCancel` no container da bolha (a `<div>` com classe `group relative ...`) que iniciam um `setTimeout` de 2000ms para abrir o menu.
   - Cancelar o timer se o dedo for solto, sair, ou houver scroll.
   - Quando disparar, chamar `setMenuOpen(true)` e fazer `e.preventDefault()` para evitar disparo de clique/seleção subsequente.
   - Adicionar `style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}` no container para evitar o menu nativo de copiar/selecionar do iOS durante o press.

4. **DropdownMenuTrigger** continua existindo (invisível no mobile) apenas como âncora — para o mobile, usar um `<DropdownMenuTrigger asChild><span className="sr-only" /></DropdownMenuTrigger>` posicionado, OU manter o trigger atual e abrir via estado controlado (sem precisar de clique no trigger). A segunda opção é mais simples: o menu controlado abre ancorado no `DropdownMenuContent` que se posiciona a partir do trigger DOM — manteremos o `<DropdownMenuTrigger asChild><button ... /></DropdownMenuTrigger>` mas com `className` que esconde o botão no mobile (`hidden sm:block` em vez de `opacity-0 group-hover:opacity-100`). No desktop, o usuário ainda pode clicar na seta; no mobile, abrir via long-press com `setMenuOpen(true)`.

5. **Acessibilidade desktop**: manter `group-hover:opacity-100` para a seta no breakpoint `sm:` em diante.

## Detalhes técnicos

- Constante `LONG_PRESS_MS = 2000`.
- Timer armazenado em `useRef<number | null>(null)` para limpar corretamente.
- Limpar o timer no `useEffect` cleanup quando o componente desmontar.
- Não alterar nenhuma lógica de envio, edição ou exclusão — apenas a forma de abrir o menu.

## Fora de escopo
- Lista de conversas e outras telas.
- Comportamento de seleção múltipla (WhatsApp também tem, mas não foi pedido).
