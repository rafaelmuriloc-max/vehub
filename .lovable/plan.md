

# Excluir PDF base64 da análise de keywords

## Problema

A linha 159 faz `JSON.stringify(responseData)` que inclui o campo PDF base64 (string enorme). Caracteres aleatórios do base64 podem coincidir com termos como "debito" ou "multa", gerando falsos positivos.

## Solução

Criar uma cópia do `responseData` sem os campos de PDF antes de stringificar para a busca de keywords. Também excluir strings longas (>500 chars) que são provavelmente blobs binários.

### Mudança em `src/components/integra-contador/SituacaoFiscalTab.tsx` (linhas 158-159)

Substituir:
```typescript
const responseStr = JSON.stringify(responseData || '').toLowerCase();
```

Por uma função que remove campos PDF/base64 antes de stringificar:
```typescript
// Strip PDF/base64 blobs before keyword search to avoid false positives
const stripBinaryFields = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripBinaryFields);
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'pdf' || k === 'pdf_base64') continue;
    if (typeof v === 'string' && v.length > 500) continue;
    if (typeof v === 'object') {
      clean[k] = stripBinaryFields(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
};
const responseStr = JSON.stringify(stripBinaryFields(responseData) || '').toLowerCase();
```

| Arquivo | Mudança |
|---------|--------|
| `src/components/integra-contador/SituacaoFiscalTab.tsx` | Filtrar campos binários/PDF antes da busca por keywords |

