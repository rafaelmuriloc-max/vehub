

# Corrigir download de documentos cross-origin no chat

## Problema
O atributo `download` no `<a>` é ignorado pelo navegador quando a URL é cross-origin (de outro domínio, como Supabase Storage). O clique não faz nada.

## Solução
Usar `fetch()` para baixar o arquivo como blob e criar um link temporário com `URL.createObjectURL()` para forçar o download programaticamente.

## Alteração

### `src/components/chat/MessageBubble.tsx`
- Substituir o `<a download>` por um `<button>` com handler `onClick`
- No handler: `fetch(mediaUrl)` → `.blob()` → `URL.createObjectURL()` → criar `<a>` temporário com `download` + `.click()` → `URL.revokeObjectURL()`
- Isso funciona porque o blob criado é local (same-origin)

