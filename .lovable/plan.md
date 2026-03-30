

# Corrigir upload de documentos societários com espaços no nome

## Problema
O Supabase Storage rejeita chaves (paths) com espaços. O nome do arquivo é usado diretamente no path: `{clientId}/societario/{label}/{file.name}`, causando "Invalid key" quando o nome tem espaços ou caracteres especiais.

## Solução em `src/pages/Clients.tsx` (linha 174)
Sanitizar o nome do arquivo substituindo espaços e caracteres especiais por underscore antes de usar no path do storage.

```typescript
// ANTES
const path = `${editing.id}/societario/${label}/${file.name}`;

// DEPOIS
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
const path = `${editing.id}/societario/${label}/${safeName}`;
```

Manter `file.name` original no campo `file_name` do banco para exibição ao usuário.

## Detalhes técnicos
- Apenas 1 linha alterada em `src/pages/Clients.tsx`
- Sem mudanças no banco

