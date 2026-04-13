

# Fix botões PDF na Situação Fiscal

## Problemas identificados

1. **`extractTextData` vaza o base64 do PDF como texto** — a função itera todos os campos de `dados` e exibe strings, incluindo o campo `pdf` com a string base64 gigante. Isso polui a UI e pode estar empurrando os botões para fora da área visível.

2. **Layout dos botões pode estar cortado** — o card usa `flex justify-between` sem wrapping, então em telas menores os botões podem sair do viewport.

## Mudanças

### `src/pages/IntegraContador.tsx`

1. **`extractTextData`** (linha 516): filtrar campos que são strings longas começando com `JVBERi0` (PDF base64) ou que tenham chave `pdf`:
```typescript
if (k === 'pdf') continue;
if (typeof v === 'string' && v.length > 500) continue;
```

2. **Layout do card de arquivo** (linha 815): trocar `flex items-center justify-between` por `flex flex-col sm:flex-row items-start sm:items-center gap-3` para garantir que os botões apareçam mesmo em containers estreitos.

| Arquivo | Mudança |
|---------|--------|
| `src/pages/IntegraContador.tsx` | Filtrar campo `pdf` do textData + ajustar layout responsivo dos botões |

