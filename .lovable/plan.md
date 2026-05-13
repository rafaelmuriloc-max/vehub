## Objetivo
Ao clicar em um arquivo/documento recebido no chat, abrir o arquivo em uma nova aba do navegador em vez de forçar o download.

## Alterações necessárias

### `src/components/chat/MessageBubble.tsx`
- Modificar o `handleClick` do componente `DocumentMessage`.
- Remover a lógica de `fetch` + blob + `a.download`.
- Substituir por `window.open(mediaUrl, '_blank')` para abrir diretamente em nova aba.
- Manter o fallback para casos onde a aba possa ser bloqueada.

## Comportamento esperado
- Imagens e vídeos continuam a funcionar como hoje (já abrem/visualizam inline).
- Documentos (PDF, DOC, XLS, etc.) passam a abrir em nova aba ao clicar.
- O usuário pode usar o botão de download nativo do visualizador do navegador se quiser salvar.
