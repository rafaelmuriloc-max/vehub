

# Validar reference_month antes de importar documento

## Problema
A IA retorna `reference_month: "0001-69"` (inválido), que é truthy e passa na verificação da linha 280. Isso gera o path de storage `clientId/0001-69-01/docTypeId/file.pdf`, que o Supabase Storage rejeita com `"new row violates row-level security policy"` na tabela `objects`.

## Solução

### `src/pages/Documents.tsx`

1. **Criar função `isValidRefMonth`** (após `extractRefMonthFromText`, ~linha 111):
```typescript
function isValidRefMonth(m: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(m)) return false;
  const [y, mo] = m.split('-').map(Number);
  return y >= 2000 && y <= 2099 && mo >= 1 && mo <= 12;
}
```

2. **Aplicar na extração por região** (linha 225): trocar `if (refMonth)` por `if (isValidRefMonth(refMonth))`

3. **Aplicar na classificação por IA** (linha 280): trocar `if (matchedClientId && matchedDocTypeId && referenceMonth)` por `if (matchedClientId && matchedDocTypeId && isValidRefMonth(referenceMonth))`

4. **Aplicar na revisão manual** (linha 309, `handleReviewConfirm`): antes de chamar `importDocument`, validar com `isValidRefMonth` e mostrar toast de erro se inválido.

## Arquivo alterado
- `src/pages/Documents.tsx` — ~10 linhas (1 função nova + 3 guards)

