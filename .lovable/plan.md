

# Corrigir visualização de PDF no Safari/iOS (WebKitBlobResource erro 1)

## Problema
O Safari no iOS não suporta `window.open()` com blob URLs — retorna o erro "WebKitBlobResource erro 1". A função `openBase64Pdf` usa exatamente esse padrão.

## Solução
Substituir `window.open(blobUrl)` por uma abordagem compatível com Safari: usar um `<iframe>` embutido na página ou converter o base64 em data URL (`data:application/pdf;base64,...`) que o Safari consegue abrir. A abordagem mais robusta para iOS é forçar o download ao invés de tentar abrir em nova aba, já que o Safari tem restrições severas com blobs.

## Alteração em `src/pages/IntegraContador.tsx`

Reescrever `openBase64Pdf` (~linhas 404-411):

```typescript
function openBase64Pdf(base64: string, filename: string) {
  // Safari/iOS não suporta window.open com blob URLs
  // Usar data URL que funciona em todos os browsers
  const dataUrl = `data:application/pdf;base64,${base64}`;
  
  // Tentar abrir em nova aba
  const newWindow = window.open(dataUrl, '_blank');
  
  // Se bloqueado (iOS Safari), fazer download direto
  if (!newWindow) {
    downloadBase64Pdf(base64, filename);
  }
}
```

**Nota**: Data URLs muito grandes (>2MB) podem falhar em alguns browsers. Para esses casos, o fallback para download garante que o usuário sempre recebe o arquivo.

## Arquivo alterado
- `src/pages/IntegraContador.tsx` — ~8 linhas (função `openBase64Pdf`)

## Resultado esperado
O botão "Visualizar" funciona no Safari/iOS — abre o PDF ou faz download automático como fallback.

