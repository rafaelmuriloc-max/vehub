# Enviar mensagem junto com a guia recalculada

## O que será feito
- Na janela "Recalcular guia", depois de gerar a guia, aparece uma caixa de texto com a mensagem para o cliente, já preenchida e editável. Exemplo:

  "Olá! Segue a guia do Simples Nacional (DAS) da competência 09/2026 da empresa EMPRESA X, recalculada com juros e multa até hoje. Qualquer dúvida, estamos à disposição."

  Na DCTFWeb o texto muda para "guia da DCTFWeb (DARF previdenciário)".
- Ao clicar em **Enviar no chat**, vai primeiro a mensagem e logo depois o PDF da guia.
- Se você apagar todo o texto, vai só a guia, como hoje.

## Detalhes técnicos
- `RecalcGuiaDialog.tsx`: estado `mensagem` com `Textarea`, preenchido ao gerar o PDF; `onSend(file, mensagem)`.
- `Chat.tsx`: `onSend` chama `sendMessage(mensagem)` (se não vazia) e depois `sendMedia(file, 'document')`, em sequência.
- Sem mudança no banco nem nas funções do servidor.
