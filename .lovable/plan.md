

# Corrigir download de documentos no chat

## Problema
O link do documento usa `target="_blank"` que tenta abrir em nova aba, mas não funciona. Precisa forçar o download.

## Alteração

### `src/components/chat/MessageBubble.tsx`
- No case `whatsapp_document`, adicionar atributo `download` no `<a>` para forçar o download do arquivo
- Remover `target="_blank"` pois o comportamento desejado é baixar, não abrir

