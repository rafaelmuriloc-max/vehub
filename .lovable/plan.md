# Abrir chat em janela popup isolada

## Diagnóstico

A rota `/chat/popup` já está fora do `AppLayout` em `src/App.tsx`, então tecnicamente carrega só o `<Chat />` sem sidebar. O problema percebido vem de dois pontos no `window.open`:

1. A string de features atual é `'width=1200,height=800,noopener=no'`. O parâmetro `noopener=no` não é uma feature válida e, em navegadores baseados em Chromium, a ausência da flag `popup=yes` (ou de uma combinação reconhecida) faz o navegador abrir uma **nova aba comum** em vez de uma janela popup. Numa aba normal, o usuário enxerga a aba como "o sistema inteiro" aberto, mesmo que o conteúdo seja só o chat.
2. Mesmo abrindo na rota correta, faltam ajustes para reforçar o isolamento (sem barra de navegação, sem botão extra de "abrir em nova janela" duplicado etc.).

## Mudanças

### 1. `src/components/chat/ConversationList.tsx`
- Trocar a string de features do `window.open` por uma que force janela popup real, sem chrome do navegador:
  ```
  window.open(
    '/chat/popup',
    'chat_popup',
    'popup=yes,width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
  )
  ```
- Manter a condição `pathname !== '/chat/popup'` para não exibir o botão dentro do próprio popup.

### 2. `src/pages/ChatPopup.tsx`
- Manter como está (já renderiza apenas `<Chat />` em fullscreen, sem `AppLayout`).
- Garantir que o botão "voltar" do `ConversationList` (`onNavigateBack`) não saia para `/` quando estiver no popup. Opção: passar uma prop opcional ou detectar `pathname === '/chat/popup'` no `Chat.tsx` e, nesse caso, usar `window.close()` em vez de `navigate('/')`.

### 3. `src/pages/Chat.tsx`
- Em `onNavigateBack`, quando a rota for `/chat/popup`, chamar `window.close()` (fecha a janela popup) em vez de navegar para o dashboard. Em `/chat` normal, mantém o `navigate('/')`.

## Resultado esperado

Clicar no ícone de "Abrir em nova janela" abre uma janela popup limpa (sem barra de endereço, sem sidebar do sistema, sem header) contendo apenas a interface do chat. O botão "voltar" dentro dessa janela fecha o popup.
