Trocar o envio direto por uma área de "anexos pendentes" antes do envio.

## Comportamento
1. Ao arrastar e soltar arquivos na conversa, eles ficam em uma fila de anexos pendentes (não são enviados ainda).
2. Acima do input do chat aparece uma barra com miniaturas/ícones dos arquivos anexados, com botão `X` para remover cada um.
3. O usuário pode digitar uma mensagem opcional e clicar em Enviar (ou Enter).
4. Ao enviar:
   - Cada arquivo é enviado via `onSendMedia` (mantendo a lógica atual).
   - Se houver texto, é enviado em seguida via `onSend`.
   - A fila de anexos é limpa.
5. O mesmo fluxo é aplicado aos arquivos escolhidos via botão "+" (Imagem/Vídeo/Áudio/Arquivo): em vez de enviar direto, vão para a fila.
6. Quando há anexos pendentes, o botão de microfone é substituído pelo botão Enviar mesmo sem texto.

## Onde mexer
- `MessageArea.tsx`: manter o overlay de drop, mas em vez de chamar `onSendMedia` direto, acumular em estado `pendingFiles` e passar para `ChatInput`.
- `ChatInput.tsx`: receber `pendingFiles` + callbacks (`onRemoveFile`, `onClearFiles`); renderizar barra de previews acima do textarea; ajustar `handleSend` para disparar mídias + texto; atalho de seleção de arquivos pelo `+` também adiciona à fila.

## Fora de escopo
- Backend e edge functions ficam intactos.
- Áudio gravado pelo microfone continua sendo enviado direto (fluxo "push to talk").