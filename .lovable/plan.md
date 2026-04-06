

# Corrigir erro "Invalid key" no upload de documentos

## Problema
O upload falha quando o nome do arquivo contém caracteres acentuados (ex: `Recibo de salário.pdf`). O Supabase Storage não aceita caracteres especiais como `á`, `é`, `ç` etc. no path do arquivo.

## Causa
Na função `importDocument` (Documents.tsx, linha 329), o `file.name` é usado diretamente no path de upload sem sanitização:
```typescript
const path = `${clientId}/${refMonth}/${docTypeId}/${file.name}`;
```

## Solução
Sanitizar o nome do arquivo antes de usá-lo no path, removendo acentos (via `normalize('NFD')` + regex) e substituindo caracteres especiais por underscore. O nome original é preservado no campo `file_name` do banco de dados para exibição.

## Alteração técnica

### Arquivo: `src/pages/Documents.tsx`

Adicionar função de sanitização e aplicá-la no path de upload:

```typescript
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // substitui caracteres especiais
}
```

Na linha 329, trocar:
```typescript
const path = `${clientId}/${refMonth}/${docTypeId}/${file.name}`;
```
por:
```typescript
const path = `${clientId}/${refMonth}/${docTypeId}/${sanitizeFileName(file.name)}`;
```

O `file_name` no banco (linha 338) continua usando `file.name` original para exibição correta ao usuário.

## Arquivo alterado
- `src/pages/Documents.tsx` — ~6 linhas adicionadas/alteradas

