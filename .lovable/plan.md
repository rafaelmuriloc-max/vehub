## Objetivo

Permitir que o usuário cole (Ctrl/Cmd+V) uma imagem da área de transferência diretamente no campo de mensagem do chat e ela seja adicionada como anexo pendente, pronta para envio.

## Mudança

Arquivo: `src/components/chat/ChatInput.tsx`

- Adicionar um handler `onPaste` no `<textarea>` da mensagem.
- Para cada item em `e.clipboardData.items` cujo `kind === 'file'` e `type` começa com `image/`, chamar `getAsFile()`, gerar um nome (`pasted_<timestamp>.<ext>`) e adicioná-lo via `onAddPendingFiles?.([file])`.
- Quando houver pelo menos uma imagem colada, chamar `e.preventDefault()` para evitar que o browser tente colar o nome do arquivo como texto.
- Texto colado normalmente continua funcionando (sem `preventDefault` quando não há imagens).

## Fora de escopo

- Colar vídeos/PDFs (clipboard normalmente não os expõe; arquivos vão pelo botão Anexar ou drag-drop).
- Pré-visualização especial — o anexo aparece na mesma faixa de `pendingFiles` já existente.
- Mudanças no fluxo de envio (`onSendMedia`) — reaproveita o pipeline atual.
