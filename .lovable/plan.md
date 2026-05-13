# Chat mobile-first / responsivo

Ajustar a tela `/chat` para ocupar exatamente a viewport no celular, sem scroll externo, sem bordas/cantos arredondados desnecessários e com cabeçalhos/abas que cabem em telas estreitas (≤402px).

## Problemas atuais

1. **Altura/scroll duplo no mobile**
   - `AppLayout` usa `<main className="flex-1 overflow-auto">` dentro de `min-h-screen` e injeta `h-full` para a rota `/chat`. Em algumas situações cria scroll vertical extra e empurra o input para fora da área visível.
   - O container do Chat usa `h-[100dvh]` mesmo no desktop (mistura `100dvh` com `md:h-[calc(100vh-0px)]`), e `md:rounded-lg md:border md:shadow-sm` adiciona moldura desnecessária dentro do layout.

2. **Lista de conversas no celular**
   - Header da lista mostra botão de "voltar" + título + atualizar fotos + nova conversa — fica apertado em 360–402px.
   - Tabs `Chat / Em andamento / Geral` quebram/cortam texto em telas pequenas (texto `text-xs` mas com badge).
   - Padding lateral (`px-3 py-3`) dos itens é generoso para mobile.

3. **Área de mensagens no celular**
   - Header da conversa: botões "Transferir" e "Fechar" aparecem como `size="icon"` no mobile, mas junto com avatar + back + nome longo + telefone podem estourar a largura.
   - Corpo das mensagens: padding `px-4` é alto para mobile.
   - Input já recebeu ajuste de safe-area, mas o container pai (overflow do `<main>`) ainda pode permitir bounce/scroll.

## Alterações

### 1. `src/components/AppLayout.tsx`
- Para a rota `/chat`, renderizar o `<main>` sem `overflow-auto` e sem o header mobile (já está oculto), com `h-[100dvh]` próprio para evitar scroll duplicado:
  - `<main className={location.pathname === '/chat' ? 'flex-1 h-[100dvh] overflow-hidden' : 'flex-1 overflow-auto'}>`.
- O wrapper interno continua `h-full` para `/chat`.

### 2. `src/pages/Chat.tsx` (linha 519)
- Trocar o container raiz para mobile-first puro:
  - `className="flex h-[100dvh] w-full overflow-hidden bg-background md:h-screen md:rounded-none md:border-0 md:shadow-none"`.
- Remover bordas/sombras/raio que só faziam sentido como "card" e estavam atrapalhando o full-bleed mobile.

### 3. `src/components/chat/ConversationList.tsx`
- Header: reduzir para `p-2` no mobile (`p-2 md:p-3`), tornar título `text-sm md:text-base`, e esconder o botão "Atualizar fotos" em telas <`sm` (`hidden sm:inline-flex`) — mantendo apenas back, título e nova conversa no celular.
- Tabs: encurtar labels no mobile com `<span className="md:hidden">…</span><span className="hidden md:inline">…</span>`:
  - "Chat" / "Andamento" / "Geral" (mobile) vs "Chat" / "Em andamento" / "Geral" (desktop).
- Itens da lista: `px-2 py-2.5 md:px-3 md:py-3`, avatar `h-11 w-11 md:h-12 md:w-12`.

### 4. `src/components/chat/MessageArea.tsx`
- Header da conversa: `px-2 py-2 md:px-4` e tornar avatar `h-9 w-9 md:h-10 md:w-10`. Garantir que `min-w-0` no bloco do nome corte com `truncate`.
- Botões "Transferir" / "Fechar" / "Reabrir": permanecem `size="icon"` no mobile (já estão), mas reduzir gap do header para `gap-1.5 md:gap-2` para sobrar espaço.
- Área de mensagens: `px-2 py-2 md:px-4` para aproveitar largura no mobile.
- Manter `flex-1 overflow-y-auto` (já está).

### 5. `src/components/chat/ChatInput.tsx`
- Reduzir paddings laterais no mobile: `p-1.5 md:p-2` no container.
- Manter `pb-[calc(env(safe-area-inset-bottom,0px)+16px)]` (já ajustado).

## Não vai mudar

- Lógica de carregamento de conversas, mensagens, realtime, envio de mídia, transferência ou fechamento de chamados.
- Visual desktop continua igual; mudanças são apenas nos breakpoints abaixo de `md`.
- Cores e tokens do design system permanecem os mesmos.

## Verificação

Após implementar, testar no preview a 402×632 (mobile atual): a lista deve preencher 100dvh sem scroll do `<main>`; ao abrir uma conversa, o header da conversa, mensagens e input devem caber sem cortes; o input fica colado na parte inferior respeitando a safe area; nenhuma barra de scroll horizontal aparece.
