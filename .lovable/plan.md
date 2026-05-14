Adicionar suporte a arrastar e soltar arquivos diretamente sobre a área da conversa.

1. Na área de mensagens (`MessageArea`), adicionar handlers `onDragOver`, `onDragLeave` e `onDrop` no container principal.
2. Ao detectar arquivos sendo arrastados, exibir overlay visual ("Solte o arquivo para enviar") sobre a conversa.
3. Ao soltar, detectar automaticamente o tipo (imagem, vídeo, áudio ou documento) pelo `file.type` e chamar `onSendMedia` para cada arquivo (suporte múltiplos).
4. Desativar o drop quando o chamado estiver fechado (`isClosed`) ou nenhuma conversa selecionada.
5. Sem alterações de backend — reutiliza o fluxo existente `sendMedia` do `Chat.tsx`.