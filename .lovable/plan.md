

# Busca por CNPJ raiz (8 primeiros dígitos) no upload de documentos

## Problema
Ao importar documentos como guia do FGTS, o CNPJ extraído pode ser de uma filial (diferente sufixo) ou o sistema não encontra match exato com os 14 dígitos. A busca atual (`matchClient`) exige correspondência exata dos 14 dígitos.

## Solução
Alterar a função `matchClient` em `src/pages/Documents.tsx` para, quando não encontrar correspondência exata com 14 dígitos, fazer fallback buscando pelo CNPJ raiz (8 primeiros dígitos).

## Alteração em `src/pages/Documents.tsx`

### Função `matchClient` (linhas 73-79)
Lógica atual:
```typescript
function matchClient(cnpj: string): string {
  if (!cnpj) return '';
  const clean = cleanCnpj(cnpj);
  if (clean.length !== 14) return '';
  const found = clients.find(c => cleanCnpj(c.document) === clean);
  return found?.id || '';
}
```

Nova lógica:
```typescript
function matchClient(cnpj: string): string {
  if (!cnpj) return '';
  const clean = cleanCnpj(cnpj);
  if (clean.length < 8) return '';
  
  // Busca exata (14 dígitos)
  if (clean.length === 14) {
    const exact = clients.find(c => cleanCnpj(c.document) === clean);
    if (exact) return exact.id;
  }
  
  // Fallback: CNPJ raiz (8 primeiros dígitos)
  const root = clean.substring(0, 8);
  const byRoot = clients.find(c => cleanCnpj(c.document).substring(0, 8) === root);
  return byRoot?.id || '';
}
```

Isso cobre o caso do FGTS e qualquer outro documento onde o CNPJ extraído seja da mesma raiz mas com sufixo diferente.

## Arquivo
- `src/pages/Documents.tsx` (apenas a função `matchClient`, ~6 linhas)

