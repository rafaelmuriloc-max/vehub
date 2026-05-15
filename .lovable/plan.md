## Objetivo

No mobile, o painel "Tarefas pendentes" deve abrir como um overlay logo abaixo do header da conversa (área do retângulo vermelho da imagem) — e não ocupando a tela toda. Quando houver mais de uma tarefa, mostrar apenas um card por vez, com botões de navegação (anterior / próximo) e indicador de posição.

## Mudanças

### 1. `src/components/chat/MessageArea.tsx` — posicionamento mobile do `rightPanel`

Hoje o `rightPanel` é renderizado como `<aside class="w-full md:w-[420px] ...">` ao lado da área de mensagens. No mobile isso ocupa a tela inteira da conversa.

- Detectar mobile via `useIsMobile()` (já usado em `Chat.tsx`).
- No mobile, renderizar o `rightPanel` como overlay absoluto dentro do container da conversa, abaixo do header (`top: header height ~56px`), ocupando largura total, com `max-h` ~70% da altura da conversa, fundo `bg-background`, borda inferior, sombra e `z-30`. Manter o conteúdo rolável internamente (o painel já tem `ScrollArea`).
- No desktop (md+), manter o comportamento atual (`aside` lateral de 420px).

### 2. `src/components/chat/PendingTasksPanel.tsx` — navegação 1 a 1 no mobile

- Adicionar `useIsMobile()`.
- Adicionar estado `currentIndex` (default 0). Resetar para 0 sempre que `tasks.length` mudar ou quando o índice ficar fora do range.
- No mobile:
  - Renderizar apenas `tasks[currentIndex]` (mesmo card que já existe hoje).
  - Acima da lista, mostrar uma barra de navegação compacta: botão `‹` (ChevronLeft), texto "X de Y", botão `›` (ChevronRight). Botões desabilitados nos extremos.
  - Manter o cabeçalho atual ("Tarefas pendentes" + contagem + botão fechar).
- No desktop: manter o comportamento atual (lista vertical de todos os cards).

Ícones `ChevronLeft` / `ChevronRight` do `lucide-react`.

Sem mudanças em schema, RPCs, edge functions ou em outras telas.
