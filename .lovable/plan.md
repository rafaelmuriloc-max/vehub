## Objetivo

Permitir selecionar e enviar múltiplos arquivos de uma mesma obrigação de uma vez, com botão "Enviar todos".

## Mudanças em `src/components/chat/AttachFromObligationDialog.tsx`

- Trocar `filePath: string` por `selectedPaths: Set<string>` (multi-seleção).
- Cada item da lista vira um checkbox clicável (alterna no `Set`). Manter o highlight `bg-accent` para o que está selecionado.
- Acima da lista, adicionar uma linha com:
  - Checkbox "Selecionar todos" (marca/desmarca todos os arquivos visíveis).
  - Contador `N de M selecionados`.
- Footer:
  - Botão "Cancelar".
  - Botão **"Enviar selecionados"** (envia apenas os marcados; desabilitado se nenhum).
  - Botão **"Enviar todos"** (envia todos os arquivos da obrigação; só aparece quando há mais de 1 arquivo).
- Lógica de envio:
  - Para cada arquivo escolhido: gera signed URL (`createSignedUrl`, 7 dias) e chama `onSend(url, fileName, type)` em sequência (await em loop) para evitar throttling do WhatsApp.
  - Estado `sending` mostra um `Loader2` no botão; também mostrar `Enviando X/Y...` no botão durante o progresso.
  - Se algum arquivo falhar, exibir um toast com a contagem de sucessos/falhas; ainda assim fechar o dialog ao final.
- Reset do `Set` quando trocar de obrigação ou fechar o dialog.

## Sem mudanças em outros arquivos

`Chat.tsx` já tem `sendExistingMedia` que envia uma mídia por vez — o loop fica dentro do dialog, então o pipeline existente é reutilizado sem alteração.
