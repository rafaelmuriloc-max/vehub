

# Fix: Download XML/PDF em vez de abrir em nova aba

## Problema
Os botões XML/PDF usam `window.open(url, '_blank')` que abre o arquivo no navegador em vez de fazer download.

## Solução
Substituir `window.open` por fetch + blob download com `<a download>`:

```typescript
// Helper function
const triggerDownload = async (url: string, filename: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
};
```

Substituir as 2 ocorrências de `window.open(...)` por chamadas a `triggerDownload(url, filename)`, usando o `access_key` + extensão como nome do arquivo.

## Arquivo alterado
- `src/pages/Invoices.tsx`

